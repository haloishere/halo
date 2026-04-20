import puppeteer from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import type { Page } from 'puppeteer';
import * as jwtStore from './jwt-store.ts';

puppeteer.use(Stealth());

interface Captured {
  idToken?: string;
  refreshToken?: string;
  firebaseApiKey?: string;
}

export interface BootstrapOptions {
  headless?: boolean;
  outFile?: string;
  waitMs?: number;
  triggerText?: string;
}

export async function bootstrap(opts: BootstrapOptions = {}): Promise<jwtStore.JwtRecord> {
  const headless = opts.headless ?? true;
  const waitMs = opts.waitMs ?? 45_000;
  const triggerText = opts.triggerText ?? 'hi';

  const browser = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const captured: Captured = {};
    const bearerTokens = new Set<string>();
    const loggedUrls: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      const headers = req.headers();
      const auth = headers['authorization'];
      if (
        /dahlialabs\.dev|daydream\.ing\/api|identitytoolkit|securetoken/.test(url)
      ) {
        loggedUrls.push(`${req.method()} ${url}`);
      }
      if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        bearerTokens.add(auth.slice(7));
      }
      if (
        !captured.firebaseApiKey &&
        (url.includes('identitytoolkit.googleapis.com') ||
          url.includes('securetoken.googleapis.com'))
      ) {
        try {
          const key = new URL(url).searchParams.get('key');
          if (key) captured.firebaseApiKey = key;
        } catch {
          /* malformed url — skip */
        }
      }
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (
        url.includes('identitytoolkit.googleapis.com/v1/accounts:signUp') ||
        url.includes('daydream.ing/api/login')
      ) {
        try {
          const j = (await res.json()) as {
            idToken?: string;
            refreshToken?: string;
          };
          if (j.idToken) captured.idToken = j.idToken;
          if (j.refreshToken) captured.refreshToken = j.refreshToken;
        } catch {
          /* non-JSON response — skip */
        }
      }
    });

    await page.goto('https://daydream.ing', {
      waitUntil: 'networkidle2',
      timeout: 60_000,
    });

    await triggerChat(page, triggerText);

    const deadline = Date.now() + waitMs;
    while (
      Date.now() < deadline &&
      (!pickDaydreamToken(bearerTokens) ||
        !captured.refreshToken ||
        !captured.firebaseApiKey)
    ) {
      await sleep(500);
      if (!captured.refreshToken) {
        const rt = await readRefreshTokenFromIdb(page);
        if (rt) captured.refreshToken = rt;
      }
    }

    captured.idToken = pickDaydreamToken(bearerTokens);

    if (!captured.idToken || !captured.refreshToken || !captured.firebaseApiKey) {
      const allClaims = [...bearerTokens].map((t) => {
        try {
          const p = JSON.parse(
            Buffer.from(t.split('.')[1]!, 'base64url').toString('utf8'),
          ) as Record<string, unknown>;
          return Object.keys(p).sort().join(',');
        } catch {
          return '<undecodable>';
        }
      });
      const summary = {
        bearerTokenCount: bearerTokens.size,
        bearerClaims: allClaims,
        refreshToken: captured.refreshToken ? 'present' : null,
        firebaseApiKey: captured.firebaseApiKey ? 'present' : null,
        recentUrls: loggedUrls.slice(-30),
      };
      throw new Error(`bootstrap incomplete: ${JSON.stringify(summary, null, 2)}`);
    }

    const rec: jwtStore.JwtRecord = {
      idToken: captured.idToken,
      refreshToken: captured.refreshToken,
      firebaseApiKey: captured.firebaseApiKey,
      expiresAt: jwtStore.decodeJwtExp(captured.idToken),
      capturedAt: Date.now(),
    };
    jwtStore.save(rec, opts.outFile);
    return rec;
  } finally {
    await browser.close();
  }
}

async function triggerChat(page: Page, text: string): Promise<void> {
  const handle =
    (await page.$('textarea')) ??
    (await page.$('[contenteditable="true"]')) ??
    (await page.$('input[type="text"]'));
  if (!handle) return;
  await handle.focus();
  await page.keyboard.type(text, { delay: 40 });
  await page.keyboard.press('Enter');
}

async function readRefreshTokenFromIdb(page: Page): Promise<string | undefined> {
  try {
    const rt = await page.evaluate(async () => {
      const idb = indexedDB as IDBFactory & {
        databases?: () => Promise<{ name?: string }[]>;
      };
      const dbs = (await idb.databases?.()) ?? [];
      for (const d of dbs) {
        if (!d.name?.startsWith('firebaseLocalStorageDb')) continue;
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open(d.name!);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const tx = db.transaction('firebaseLocalStorage', 'readonly');
        const store = tx.objectStore('firebaseLocalStorage');
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const r = store.getAll();
          r.onsuccess = () => resolve(r.result as unknown[]);
          r.onerror = () => reject(r.error);
        });
        for (const row of rows) {
          const v = (row as { value?: { stsTokenManager?: { refreshToken?: string } } })
            ?.value?.stsTokenManager;
          if (v?.refreshToken) return v.refreshToken;
        }
      }
      return undefined;
    });
    return rt ?? undefined;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Only a post-/api/login token has the `daydreamUid` custom claim — that's the
// one the BFF accepts. Raw Firebase anonymous idTokens don't.
function pickDaydreamToken(tokens: Set<string>): string | undefined {
  for (const t of tokens) {
    try {
      const payload = JSON.parse(
        Buffer.from(t.split('.')[1]!, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
      if ('daydreamUid' in payload || payload.isAllowed === true) return t;
    } catch {
      /* bad token — skip */
    }
  }
  return undefined;
}
