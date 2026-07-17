// Read-only Etsy client for syncing the shop's public active listings.
//
// This deliberately uses Etsy's public application endpoints, which authenticate
// with the keystring alone (x-api-key). No OAuth, no stored tokens, nothing to
// expire or reconnect. That is all we need to mirror listings one way.

const ETSY_API = 'https://openapi.etsy.com/v3/application'

export class EtsyNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`${missing} is not set`)
    this.name = 'EtsyNotConfiguredError'
  }
}

// Etsy rejects the keystring on its own ("Shared secret is required in x-api-key
// header"), so the header is keystring:sharedSecret.
function apiKey(): string {
  const key = process.env.ETSY_KEYSTRING?.trim()
  if (!key) throw new EtsyNotConfiguredError('ETSY_KEYSTRING')
  const secret = process.env.ETSY_SHARED_SECRET?.trim()
  if (!secret) throw new EtsyNotConfiguredError('ETSY_SHARED_SECRET')
  return `${key}:${secret}`
}

export function etsyShopName(): string {
  const name = process.env.ETSY_SHOP_NAME?.trim()
  if (!name) throw new EtsyNotConfiguredError('ETSY_SHOP_NAME')
  return name
}

async function etsyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${ETSY_API}${path}`, {
    headers: { 'x-api-key': apiKey() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Etsy ${res.status} on ${path}: ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

export interface EtsyMoney {
  amount: number
  divisor: number
  currency_code: string
}

export interface EtsyImage {
  url_570xN?: string
  url_fullxfull?: string
  rank?: number
}

export interface EtsyShippingDestination {
  destination_country_iso?: string | null
  destination_region?: string | null
  primary_cost?: EtsyMoney
  min_delivery_days?: number | null
  max_delivery_days?: number | null
}

export interface EtsyShippingProfile {
  min_processing_days?: number | null
  max_processing_days?: number | null
  origin_country_iso?: string | null
  origin_postal_code?: string | null
  shipping_profile_destinations?: EtsyShippingDestination[]
}

export interface EtsyListing {
  listing_id: number
  title: string
  description: string | null
  url: string | null
  state: string
  quantity: number
  price: EtsyMoney
  images?: EtsyImage[]
  shipping_profile?: EtsyShippingProfile | null
}

export function money(m: EtsyMoney | undefined): number | null {
  if (!m || !m.divisor) return null
  return Math.round((m.amount / m.divisor) * 100) / 100
}

export async function resolveShopId(shopName: string): Promise<number> {
  const data = await etsyGet<{ count: number; results: { shop_id: number; shop_name: string }[] }>(
    `/shops?shop_name=${encodeURIComponent(shopName)}`,
  )
  // The lookup is a search, so match the name exactly rather than trusting order.
  const exact = data.results?.find((s) => s.shop_name.toLowerCase() === shopName.toLowerCase())
  const shop = exact ?? data.results?.[0]
  if (!shop) throw new Error(`No Etsy shop found named "${shopName}"`)
  return shop.shop_id
}

// Etsy pages at 100 max; walk until exhausted so a big shop isn't silently cut off.
export async function fetchActiveListings(shopId: number): Promise<EtsyListing[]> {
  const all: EtsyListing[] = []
  const limit = 100
  let offset = 0

  for (;;) {
    const page = await etsyGet<{ count: number; results: EtsyListing[] }>(
      `/shops/${shopId}/listings/active?limit=${limit}&offset=${offset}`,
    )
    const results = page.results ?? []
    all.push(...results)
    offset += results.length
    if (results.length < limit || offset >= (page.count ?? 0)) break
    if (offset > 5000) break // hard stop; no shop here is that big
  }

  return all
}

// Etsy sends money as an integer plus a divisor (e.g. 1250 / 100 = 12.50).
export function listingPrice(listing: EtsyListing): number {
  const { amount, divisor } = listing.price ?? { amount: 0, divisor: 100 }
  if (!divisor) return 0
  return Math.round((amount / divisor) * 100) / 100
}

// The active-listings endpoint ignores `includes`, but the batch lookup honours it,
// returning every image plus the shipping profile. Fetched 100 at a time rather
// than per listing. A failure here degrades to "no detail" rather than failing the
// whole sync, since the core listing data is already in hand.
export async function fetchListingDetails(
  listingIds: number[],
  includes = 'Images,Shipping,Inventory,Videos',
): Promise<Map<number, EtsyListing>> {
  const details = new Map<number, EtsyListing>()

  for (let i = 0; i < listingIds.length; i += 100) {
    const chunk = listingIds.slice(i, i + 100)
    try {
      const data = await etsyGet<{ results: EtsyListing[] }>(
        `/listings/batch?listing_ids=${chunk.join(',')}&includes=${includes}`,
      )
      for (const listing of data.results ?? []) {
        details.set(listing.listing_id, listing)
      }
    } catch (e) {
      console.error('ETSY_DETAIL_ERR ::', e instanceof Error ? e.message : String(e))
    }
  }

  return details
}

// Etsy ranks images; keep that order so the shop matches the Etsy gallery.
export function orderedImages(listing: EtsyListing | undefined): { url: string; fullUrl: string | null }[] {
  if (!listing?.images) return []
  return [...listing.images]
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((img) => ({ url: img.url_570xN ?? img.url_fullxfull ?? '', fullUrl: img.url_fullxfull ?? null }))
    .filter((img) => img.url)
}

// Etsy models shipping per destination. Surface the cheapest as the headline
// figure, preferring the origin country so a domestic buyer sees a domestic rate.
export function shippingSummary(listing: EtsyListing | undefined) {
  const profile = listing?.shipping_profile
  if (!profile) return null

  const destinations = profile.shipping_profile_destinations ?? []
  const origin = profile.origin_country_iso ?? null
  const preferred =
    destinations.find((d) => origin && d.destination_country_iso === origin) ?? destinations[0]

  return {
    processingMin: profile.min_processing_days ?? null,
    processingMax: profile.max_processing_days ?? null,
    shipsFrom: origin,
    shippingCost: money(preferred?.primary_cost) ?? null,
    shippingMinDays: preferred?.min_delivery_days ?? null,
    shippingMaxDays: preferred?.max_delivery_days ?? null,
  }
}
