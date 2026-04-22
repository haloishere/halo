const BASE = 'https://places.googleapis.com/v1'

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.primaryTypeDisplayName',
  'places.currentOpeningHours',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.editorialSummary',
].join(',')

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'primaryTypeDisplayName',
  'currentOpeningHours',
  'websiteUri',
  'nationalPhoneNumber',
  'editorialSummary',
  'regularOpeningHours',
].join(',')

export interface LatLng {
  latitude: number
  longitude: number
}

export interface OpeningHours {
  openNow?: boolean
  weekdayDescriptions?: string[]
}

export interface Place {
  id: string
  displayName: string
  formattedAddress?: string
  location?: LatLng
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  primaryTypeDisplayName?: string
  currentOpeningHours?: OpeningHours
  regularOpeningHours?: OpeningHours
  websiteUri?: string
  nationalPhoneNumber?: string
  editorialSummary?: string
}

export interface TextSearchOptions {
  locationBias?: {
    circle: { center: LatLng; radius: number }
  }
  maxResultCount?: number
}

export interface NearbySearchOptions {
  includedTypes?: string[]
  maxResultCount?: number
}

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY environment variable is not set')
  return key
}

async function post<T>(path: string, body: unknown, fieldMask: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places API ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

async function get<T>(path: string, fieldMask: string): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  const res = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': fieldMask,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places API ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

function normalisePlace(raw: Record<string, unknown>): Place {
  const displayName = raw.displayName as { text?: string } | string | undefined
  return {
    id: raw.id as string,
    displayName:
      typeof displayName === 'object' && displayName !== null
        ? (displayName.text ?? '')
        : (displayName ?? ''),
    formattedAddress: raw.formattedAddress as string | undefined,
    location: raw.location as LatLng | undefined,
    rating: raw.rating as number | undefined,
    userRatingCount: raw.userRatingCount as number | undefined,
    priceLevel: raw.priceLevel as string | undefined,
    primaryTypeDisplayName:
      (raw.primaryTypeDisplayName as { text?: string } | undefined)?.text ??
      (raw.primaryTypeDisplayName as string | undefined),
    currentOpeningHours: raw.currentOpeningHours as OpeningHours | undefined,
    regularOpeningHours: raw.regularOpeningHours as OpeningHours | undefined,
    websiteUri: raw.websiteUri as string | undefined,
    nationalPhoneNumber: raw.nationalPhoneNumber as string | undefined,
    editorialSummary:
      (raw.editorialSummary as { text?: string } | undefined)?.text ??
      (raw.editorialSummary as string | undefined),
  }
}

export async function textSearch(query: string, opts: TextSearchOptions = {}): Promise<Place[]> {
  const body: Record<string, unknown> = { textQuery: query }
  if (opts.locationBias) body.locationBias = opts.locationBias
  if (opts.maxResultCount) body.maxResultCount = opts.maxResultCount

  const res = await post<{ places?: Record<string, unknown>[] }>(
    '/places:searchText',
    body,
    SEARCH_FIELD_MASK,
  )
  return (res.places ?? []).map(normalisePlace)
}

export async function nearbySearch(
  location: LatLng,
  radius: number,
  opts: NearbySearchOptions = {},
): Promise<Place[]> {
  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: { center: location, radius },
    },
  }
  if (opts.includedTypes?.length) body.includedTypes = opts.includedTypes
  if (opts.maxResultCount) body.maxResultCount = opts.maxResultCount

  const res = await post<{ places?: Record<string, unknown>[] }>(
    '/places:searchNearby',
    body,
    SEARCH_FIELD_MASK,
  )
  return (res.places ?? []).map(normalisePlace)
}

export async function placeDetails(id: string): Promise<Place> {
  const raw = await get<Record<string, unknown>>(`/places/${id}`, DETAILS_FIELD_MASK)
  return normalisePlace(raw)
}
