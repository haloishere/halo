import * as session from './session.ts'

const API = 'https://api.mindtrip.ai'
const CDN = 'https://mindtrip.ai/cdn-cgi/image'
const PHOTO_TOKEN_RE = /^[0-9A-Za-z]{20,}$/

export interface MindtripPlace {
  ref: string
  name: string
  type: string
  description: string | null
  latitude: number | null
  longitude: number | null
  formattedAddress: string | null
  city: string | null
  country: string | null
  categoryLabel: string | null
  cuisines: string[]
  priceLevel: number | null
  userRating: number | null
  totalUserReviews: number | null
  bookingUrl: string | null
  canonicalUrl: string | null
  isMichelin: boolean
  photoUrl: string | null
}

export interface ChatResult {
  chatId: number
  messageId: number
  body: string
  places: MindtripPlace[]
  suggestedQuestions: string[]
}

export interface ClientOptions {
  sessionPath?: string
  pollIntervalMs?: number
  pollTimeoutMs?: number
}

function photoUrl(token: string | undefined): string | null {
  if (!token) return null
  if (PHOTO_TOKEN_RE.test(token)) return `${CDN}/format=webp,w=640/${token}`
  if (token.startsWith('http')) return token
  return `https://images.mindtrip.ai${token.startsWith('/') ? '' : '/'}${token}`
}

function normalisePlace(raw: Record<string, unknown>): MindtripPlace {
  const photos = raw.photos as Array<{ url?: string }> | undefined
  const categories = raw.categories as string[] | undefined
  return {
    ref: raw.entity_ref as string,
    name: raw.name as string,
    type: (raw.type as string | undefined) ?? 'place',
    description: (raw.description as string | undefined) ?? null,
    latitude: (raw.latitude as number | undefined) ?? null,
    longitude: (raw.longitude as number | undefined) ?? null,
    formattedAddress: (raw.formatted_address as string | undefined) ?? null,
    city: (raw.city as string | undefined) ?? null,
    country: (raw.country as string | undefined) ?? null,
    categoryLabel: (raw.category_label as string | undefined) ?? null,
    cuisines: (raw.cuisines as string[] | undefined) ?? [],
    priceLevel: (raw.price_level as number | undefined) ?? null,
    userRating: (raw.user_rating as number | undefined) ?? null,
    totalUserReviews: (raw.total_user_reviews as number | undefined) ?? null,
    bookingUrl: (raw.booking_url as string | undefined) ?? null,
    canonicalUrl: (raw.canonical_url as string | undefined) ?? null,
    isMichelin: categories?.some((c) => c.startsWith('michelin')) ?? false,
    photoUrl: photoUrl(photos?.[0]?.url),
  }
}

async function apiGet<T>(path: string, cookies: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { accept: 'application/json', cookie: cookies },
  })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function apiPost<T>(path: string, body: unknown, cookies: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', cookie: cookies },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function createChat(cookies: string): Promise<number> {
  const res = await apiPost<{ chat: { id: number } }>('/api/chats', {}, cookies)
  return res.chat.id
}

async function sendMessage(
  chatId: number,
  message: string,
  cookies: string,
  locationRef?: string,
): Promise<string> {
  const res = await apiPost<{ stream_id: string }>(
    `/api/chats/${chatId}/message`,
    {
      message_body: message,
      bot: 'default',
      attachments: [],
      location_of_interest: locationRef ?? null,
    },
    cookies,
  )
  return res.stream_id
}

interface RawMessage {
  id: number
  body: string
  type: 'customer' | 'bot'
  stream_id?: string
  places?: Record<string, unknown>[]
  suggested_questions?: Array<{ text: string }>
}

async function pollForBotMessage(
  chatId: number,
  streamId: string,
  cookies: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<RawMessage> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs))

    const res = await apiGet<{ messages: RawMessage[] }>(
      `/api/chats/${chatId}/messages?per_page=5`,
      cookies,
    )

    const bot = res.messages.find((m) => m.type === 'bot' && m.stream_id === streamId)
    if (bot) return bot
  }

  throw new Error(`Timed out waiting for bot response after ${timeoutMs}ms`)
}

export async function chat(message: string, opts: ClientOptions = {}): Promise<ChatResult> {
  const { pollIntervalMs = 1500, pollTimeoutMs = 30_000 } = opts
  const rec = await session.ensureFreshSession(opts.sessionPath)

  const chatId = await createChat(rec.cookies)
  const streamId = await sendMessage(chatId, message, rec.cookies)
  const botMsg = await pollForBotMessage(
    chatId,
    streamId,
    rec.cookies,
    pollIntervalMs,
    pollTimeoutMs,
  )

  return {
    chatId,
    messageId: botMsg.id,
    body: botMsg.body,
    places: (botMsg.places ?? []).map(normalisePlace),
    suggestedQuestions: (botMsg.suggested_questions ?? []).map((q) => q.text),
  }
}
