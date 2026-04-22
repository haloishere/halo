import { randomUUID } from 'node:crypto'
import type { DaydreamProduct } from '@halo/shared'
import type { JwtRecord } from './daydream.jwt.js'
import { getJwt, forceRefreshJwt } from './daydream.jwt.js'
import { grpcWebFrame, ld, str, vi } from './proto.js'

const BFF = 'https://bff.shopper.api-web.dahlialabs.dev'
const LIAISON = 'https://liaison-http.dahlialabs.dev'
const CDN = 'https://cdn.dahlialabs.dev/fotomancer/_'

// Typed error for gRPC UNAUTHENTICATED (status 16) so callers can use
// instanceof rather than parsing the error message string.
export class GrpcUnauthenticatedError extends Error {
  constructor(grpcMessage: string | null) {
    super(`gRPC UNAUTHENTICATED: ${grpcMessage ?? 'no message'}`)
    this.name = 'GrpcUnauthenticatedError'
  }
}

export interface SendResult {
  chatId: string
  messageId: string
}

export interface SearchResult {
  chatId: string
  messageId: string
  products: DaydreamProduct[]
}

// GetModuleListRequest wire format (hand-written protobuf encoding).
// Fields: 1=chatId, 2=input{1=content{1=text}}, 3=session{1=id}, 4=flags, 5=env.
function encodeSendBody(chatId: string, text: string, sessionId: string): Uint8Array {
  const input = ld(1, ld(1, ld(1, str(text))))
  const session = ld(1, str(sessionId))
  const flags = new Uint8Array([...vi(1, 3), ...vi(2, 2)])
  const env = new Uint8Array([...vi(1, 1), ...ld(2, ld(4, str('dev')))])
  return new Uint8Array([
    ...ld(1, str(chatId)),
    ...ld(2, input),
    ...ld(3, session),
    ...ld(4, flags),
    ...ld(5, env),
  ])
}

function extractMessageId(respBody: Uint8Array, chatId: string): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(respBody)
  const uuids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)
  if (!uuids?.length) {
    throw new Error(
      `No UUID found in BFF response (bytes=${respBody.length}, text[0..200]=${JSON.stringify(text.slice(0, 200))})`,
    )
  }
  const messageId = uuids.find((u) => u.toLowerCase() !== chatId.toLowerCase())
  if (!messageId) {
    throw new Error(
      `BFF response contained no UUID distinct from chatId=${chatId} ` +
        `(bytes=${respBody.length}, text[0..200]=${JSON.stringify(text.slice(0, 200))})`,
    )
  }
  return messageId
}

async function bffSend(jwt: JwtRecord, chatId: string, text: string): Promise<SendResult> {
  const sessionId = 'halo-api'
  const body = encodeSendBody(chatId, text, sessionId)
  const frame = grpcWebFrame(body)
  const res = await fetch(`${BFF}/chat.v1.ChatService/GetModuleList`, {
    method: 'POST',
    headers: {
      'content-type': 'application/grpc-web+proto',
      accept: 'application/grpc-web+proto',
      authorization: `Bearer ${jwt.idToken}`,
      'x-grpc-web': '1',
      'x-user-agent': 'halo-api/0.0.1',
    },
    body: frame as unknown as BodyInit,
  })
  if (!res.ok) {
    throw new Error(`BFF send failed: ${res.status} ${await res.text()}`)
  }
  const grpcStatus = res.headers.get('grpc-status')
  if (grpcStatus === '16') {
    throw new GrpcUnauthenticatedError(res.headers.get('grpc-message'))
  }
  if (grpcStatus && grpcStatus !== '0') {
    throw new Error(`grpc-status=${grpcStatus} grpc-message=${res.headers.get('grpc-message')}`)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  const respBody = buf.length > 5 ? buf.subarray(5) : buf
  const messageId = extractMessageId(respBody, chatId)
  return { chatId, messageId }
}

export async function sendMessage(text: string, opts: { chatId?: string } = {}): Promise<SendResult> {
  const chatId = opts.chatId ?? randomUUID()
  const rec = await getJwt()
  try {
    return await bffSend(rec, chatId, text)
  } catch (err) {
    if (err instanceof GrpcUnauthenticatedError) {
      const fresh = await forceRefreshJwt()
      return await bffSend(fresh, chatId, text)
    }
    throw err
  }
}

interface RawVariant {
  availabilityState?: string
  clickoutUrl?: string
}

interface RawPricing {
  regularMinPrice?: number
  effectiveBuyMin?: number
}

interface RawOption {
  mainImage?: string
  pricingSummary?: RawPricing
  regularMinPrice?: number
  saleMinPrice?: number
  variants?: RawVariant[]
}

interface RawProduct {
  id: string
  name: string
  description?: string
  brandData?: { name?: string }
  options?: RawOption[]
}

function cdnImage(imagePath: string | undefined): string {
  if (!imagePath) return ''
  if (imagePath.startsWith('http')) return imagePath
  const bare = imagePath.replace(/^products\//, '')
  return `${CDN}/rs:fit:640:0/plain/products://products/${bare}`
}

function mapProduct(p: RawProduct): DaydreamProduct {
  const opt = p.options?.[0]
  const pricing = opt?.pricingSummary
  const variants = opt?.variants ?? []
  const available = variants.filter((v) => v.availabilityState === 'AVAILABILITY_STATE_AVAILABLE')
  const firstShop = available[0]?.clickoutUrl ?? variants[0]?.clickoutUrl ?? ''
  const priceCents = pricing?.effectiveBuyMin ?? opt?.saleMinPrice ?? opt?.regularMinPrice ?? 0
  const regularPriceCents = pricing?.regularMinPrice ?? opt?.regularMinPrice ?? priceCents
  return {
    id: p.id,
    brand: p.brandData?.name ?? null,
    name: p.name,
    description: p.description ?? null,
    priceCents,
    regularPriceCents,
    onSale: priceCents < regularPriceCents,
    currency: 'USD',
    imageUrl: cdnImage(opt?.mainImage),
    sizesInStock: available.length,
    sizesTotal: variants.length,
    shopUrl: firstShop,
  }
}

export async function listProducts(chatId: string, messageId: string, pageSize = 20): Promise<DaydreamProduct[]> {
  const rec = await getJwt()
  const url = `${LIAISON}/dahlialabs.liaison.v1beta1.ProductService/ListProductCards`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${rec.idToken}`,
      'connect-protocol-version': '1',
    },
    body: JSON.stringify({ pageSize, chatSearchContext: { chatId, messageId } }),
  })
  if (!res.ok) {
    throw new Error(`Liaison list failed: ${res.status} ${await res.text()}`)
  }
  const j = (await res.json()) as { products?: RawProduct[] }
  return (j.products ?? []).map(mapProduct)
}

export async function search(query: string): Promise<SearchResult> {
  const sent = await sendMessage(query)
  const products = await listProducts(sent.chatId, sent.messageId)
  return { chatId: sent.chatId, messageId: sent.messageId, products }
}
