import { randomUUID } from 'node:crypto';
import * as jwtStore from './jwt-store.ts';
import { grpcWebFrame, ld, str, vi } from './proto.ts';

const BFF = 'https://bff.shopper.api-web.dahlialabs.dev';
const LIAISON = 'https://liaison-http.dahlialabs.dev';

export interface DaydreamProduct {
  id: string;
  brand: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  regularPriceCents: number;
  onSale: boolean;
  currency: string;
  imageUrl: string;
  sizesInStock: number;
  sizesTotal: number;
  shopUrl: string;
}

export interface SendResult {
  chatId: string;
  messageId: string;
  rawResponse: Uint8Array;
}

export interface SearchResult {
  chatId: string;
  messageId: string;
  products: DaydreamProduct[];
}

export interface DaydreamClientOptions {
  jwtPath?: string;
  sessionId?: string;
}

async function ensureFreshJwt(jwtPath?: string): Promise<jwtStore.JwtRecord> {
  const rec = jwtStore.load(jwtPath);
  if (!rec) {
    throw new Error(
      'No JWT found. Run `pnpm --filter @halo/daydream-tool bootstrap` first.',
    );
  }
  if (jwtStore.isExpiring(rec)) {
    const fresh = await jwtStore.refresh(rec);
    jwtStore.save(fresh, jwtPath);
    return fresh;
  }
  return rec;
}

// GetModuleListRequest wire format derived from the spike:
//   1: chatId (string)
//   2: input { 1: content { 1: text (string) } }
//   3: session { 1: id (string) }
//   4: flags  { 1: varint=3, 2: varint=2 }
//   5: env    { 1: varint=1, 2: bytes { 4: "dev" } }
function encodeSendBody(chatId: string, text: string, sessionId: string): Uint8Array {
  const input = ld(1, ld(1, ld(1, str(text))));
  const session = ld(1, str(sessionId));
  const flags = new Uint8Array([...vi(1, 3), ...vi(2, 2)]);
  const env = new Uint8Array([...vi(1, 1), ...ld(2, ld(4, str('dev')))]);
  return new Uint8Array([
    ...ld(1, str(chatId)),
    ...ld(2, input),
    ...ld(3, session),
    ...ld(4, flags),
    ...ld(5, env),
  ]);
}

function extractMessageId(respBody: Uint8Array, chatId: string): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(respBody);
  const uuids = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  );
  if (!uuids?.length) {
    const hex = Array.from(respBody.subarray(0, 256))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const preview = text.slice(0, 500);
    throw new Error(
      `No UUID found in BFF response. bytes=${respBody.length} hex[0..256]=${hex} text[0..500]=${JSON.stringify(preview)}`,
    );
  }
  const msgId = uuids.find((u) => u.toLowerCase() !== chatId.toLowerCase());
  return msgId ?? uuids[0]!;
}

export async function sendMessage(
  text: string,
  opts: { chatId?: string } & DaydreamClientOptions = {},
): Promise<SendResult> {
  const rec = await ensureFreshJwt(opts.jwtPath);
  const chatId = opts.chatId ?? randomUUID();
  const sessionId = opts.sessionId ?? 'halo-daydream-tool';
  const body = encodeSendBody(chatId, text, sessionId);
  const frame = grpcWebFrame(body);
  const res = await fetch(`${BFF}/chat.v1.ChatService/GetModuleList`, {
    method: 'POST',
    headers: {
      'content-type': 'application/grpc-web+proto',
      accept: 'application/grpc-web+proto',
      authorization: `Bearer ${rec.idToken}`,
      'x-grpc-web': '1',
      'x-user-agent': 'halo-daydream-tool/0.0.1',
    },
    body: frame as unknown as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`BFF send failed: ${res.status} ${await res.text()}`);
  }
  const grpcStatus = res.headers.get('grpc-status');
  const grpcMessage = res.headers.get('grpc-message');
  if (grpcStatus && grpcStatus !== '0') {
    throw new Error(`BFF gRPC error: status=${grpcStatus} message=${grpcMessage}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const respBody = buf.length > 5 ? buf.subarray(5) : buf;
  const messageId = extractMessageId(respBody, chatId);
  return { chatId, messageId, rawResponse: buf };
}

interface RawVariant {
  availabilityState?: string;
  clickoutUrl?: string;
}

interface RawPricing {
  regularMinPrice?: number;
  regularMaxPrice?: number;
  saleMinPrice?: number;
  saleMaxPrice?: number;
  effectiveBuyMin?: number;
  effectiveBuyMax?: number;
}

interface RawOption {
  mainImage?: string;
  pricingSummary?: RawPricing;
  regularMinPrice?: number;
  saleMinPrice?: number;
  variants?: RawVariant[];
}

interface RawProduct {
  id: string;
  name: string;
  description?: string;
  brandData?: { name?: string };
  options?: RawOption[];
}

const CDN = 'https://cdn.dahlialabs.dev/fotomancer/_';

// imgproxy URL format observed on daydream.ing:
//   /fotomancer/_/rs:fit:<width>:<height>/plain/products://<path>
// The `products://` scheme prefix is required — imgproxy maps it to the backing
// bucket internally. Size 0 means "any" (preserve aspect ratio).
function cdnImage(imagePath: string | undefined, width = 600): string {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  const bare = imagePath.replace(/^products\//, '');
  return `${CDN}/rs:fit:${width}:0/plain/products://products/${bare}`;
}

function mapProduct(p: RawProduct): DaydreamProduct {
  const opt = p.options?.[0];
  const pricing = opt?.pricingSummary;
  const variants = opt?.variants ?? [];
  const available = variants.filter(
    (v) => v.availabilityState === 'AVAILABILITY_STATE_AVAILABLE',
  );
  const firstShop = available[0]?.clickoutUrl ?? variants[0]?.clickoutUrl ?? '';
  const priceCents = pricing?.effectiveBuyMin ?? opt?.saleMinPrice ?? opt?.regularMinPrice ?? 0;
  const regularPriceCents = pricing?.regularMinPrice ?? opt?.regularMinPrice ?? priceCents;
  return {
    id: p.id,
    brand: p.brandData?.name ?? null,
    name: p.name,
    description: p.description ?? null,
    priceCents,
    regularPriceCents,
    onSale: priceCents < regularPriceCents,
    currency: 'USD',
    imageUrl: cdnImage(opt?.mainImage, 640),
    sizesInStock: available.length,
    sizesTotal: variants.length,
    shopUrl: firstShop,
  };
}

export async function listProducts(
  chatId: string,
  messageId: string,
  opts: { pageSize?: number } & DaydreamClientOptions = {},
): Promise<DaydreamProduct[]> {
  const rec = await ensureFreshJwt(opts.jwtPath);
  const url = `${LIAISON}/dahlialabs.liaison.v1beta1.ProductService/ListProductCards`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${rec.idToken}`,
      'connect-protocol-version': '1',
    },
    body: JSON.stringify({
      pageSize: opts.pageSize ?? 20,
      chatSearchContext: { chatId, messageId },
    }),
  });
  if (!res.ok) {
    throw new Error(`Liaison list failed: ${res.status} ${await res.text()}`);
  }
  const j = (await res.json()) as { products?: RawProduct[] };
  return (j.products ?? []).map(mapProduct);
}

export async function search(
  query: string,
  opts: DaydreamClientOptions = {},
): Promise<SearchResult> {
  const sent = await sendMessage(query, opts);
  const products = await listProducts(sent.chatId, sent.messageId, opts);
  return { chatId: sent.chatId, messageId: sent.messageId, products };
}
