import { bootstrap } from './bootstrap.ts';
import { search, type SearchResult } from './client.ts';
import * as jwtStore from './jwt-store.ts';

const USAGE = `usage:
  daydream bootstrap [--headful]     mint JWT via puppeteer → .jwt.json
  daydream status                    show current JWT expiry
  daydream refresh                   refresh JWT via securetoken.googleapis.com
  daydream search "<query>" [--json] send a message + fetch product cards
`;

function formatPrice(p: { priceCents: number; regularPriceCents: number; onSale: boolean }): string {
  const price = `$${(p.priceCents / 100).toFixed(2)}`;
  if (!p.onSale) return price;
  return `${price} (was $${(p.regularPriceCents / 100).toFixed(2)})`;
}

function renderTable(query: string, r: SearchResult): string {
  const lines: string[] = [];
  lines.push(`Search: ${query}`);
  lines.push(`${r.products.length} product(s)`);
  lines.push('');
  if (r.products.length === 0) return lines.join('\n');

  lines.push('| # | Product | Price | Image | Shop |');
  lines.push('|---|---------|-------|-------|------|');
  r.products.forEach((p, i) => {
    const name = (p.brand ? `${p.brand} — ${p.name}` : p.name).replace(/\|/g, '\\|');
    lines.push(`| ${i + 1} | ${name} | ${formatPrice(p)} | ${p.imageUrl} | ${p.shopUrl} |`);
  });
  return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;

  switch (cmd) {
    case 'bootstrap': {
      const headless = !rest.includes('--headful');
      process.stderr.write(`[bootstrap] launching puppeteer (headless=${headless})…\n`);
      const rec = await bootstrap({ headless });
      process.stderr.write(
        `[bootstrap] ok — token expires ${new Date(rec.expiresAt).toISOString()}\n`,
      );
      process.stdout.write(JSON.stringify({ expiresAt: rec.expiresAt }, null, 2) + '\n');
      return;
    }
    case 'status': {
      const cur = jwtStore.load();
      if (!cur) {
        process.stderr.write('[status] no .jwt.json — run `bootstrap` first\n');
        process.exit(1);
      }
      const secs = Math.round((cur.expiresAt - Date.now()) / 1000);
      process.stdout.write(
        JSON.stringify(
          {
            capturedAt: new Date(cur.capturedAt).toISOString(),
            expiresAt: new Date(cur.expiresAt).toISOString(),
            expiresInSec: secs,
            isExpiring: jwtStore.isExpiring(cur),
          },
          null,
          2,
        ) + '\n',
      );
      return;
    }
    case 'refresh': {
      const cur = jwtStore.load();
      if (!cur) throw new Error('no .jwt.json — run `bootstrap` first');
      const fresh = await jwtStore.refresh(cur);
      jwtStore.save(fresh);
      process.stderr.write(
        `[refresh] ok — expires ${new Date(fresh.expiresAt).toISOString()}\n`,
      );
      return;
    }
    case 'search': {
      const asJson = rest.includes('--json');
      const query = rest.filter((a) => a !== '--json').join(' ').trim();
      if (!query) throw new Error('usage: daydream search "<query>" [--json]');
      const result = await search(query);
      if (asJson) {
        process.stdout.write(
          JSON.stringify(
            {
              query,
              chatId: result.chatId,
              messageId: result.messageId,
              productCount: result.products.length,
              products: result.products,
            },
            null,
            2,
          ) + '\n',
        );
      } else {
        process.stdout.write(renderTable(query, result));
      }
      return;
    }
    case undefined:
    case 'help':
    case '--help':
    case '-h': {
      process.stdout.write(USAGE);
      return;
    }
    default: {
      process.stderr.write(`unknown command: ${cmd}\n${USAGE}`);
      process.exit(1);
    }
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`[error] ${msg}\n`);
  process.exit(2);
});
