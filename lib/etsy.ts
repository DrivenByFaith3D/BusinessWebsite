// Etsy public listing metadata and separately authorized inventory/shipping reads.
// Inventory/Shipping includes were retired in July 2026; scoped batch endpoints
// are passed in by the sync route so public metadata can still refresh separately.

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
  listing_image_id?: number
  url_570xN?: string
  url_fullxfull?: string
  rank?: number
}

export interface EtsyShippingDestination {
  origin_country_iso?: string | null
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

export interface EtsyPropertyValue {
  property_id?: number
  property_name?: string
  values?: string[]
}

export interface EtsyOffering {
  quantity?: number
  is_enabled?: boolean
  is_deleted?: boolean
  price?: EtsyMoney
}

export interface EtsyInventoryProduct {
  product_id?: number
  sku?: string | null
  is_deleted?: boolean
  offerings?: EtsyOffering[]
  property_values?: EtsyPropertyValue[]
}

export interface EtsyInventory {
  products?: EtsyInventoryProduct[]
}

export interface EtsyPersonalization {
  is_personalizable?: boolean
  personalization_instructions?: string | null
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
  inventory?: EtsyInventory | null
  personalization?: EtsyPersonalization | null

  tags?: string[]
  materials?: string[]
  who_made?: string | null
  when_made?: string | null
  has_variations?: boolean
  is_personalizable?: boolean
  num_favorers?: number | null
  views?: number | null
  // Processing time lives on the listing; the shipping profile leaves it unset.
  processing_min?: number | null
  processing_max?: number | null
  item_weight?: number | null
  item_weight_unit?: string | null
  item_length?: number | null
  item_width?: number | null
  item_height?: number | null
  item_dimensions_unit?: string | null
}

export interface ParsedVariation {
  etsyProductId: string | null
  sku: string | null
  price: number | null
  quantity: number
  isEnabled: boolean
  label: string
  options: { name: string; value: string }[]
}

// Etsy models each buyable combination as an inventory "product" with property
// values (Primary color: Army Blue) and offerings (price/quantity).
// null means incomplete data: callers must preserve the saved options.
export function parseVariations(listing: EtsyListing | undefined): ParsedVariation[] | null {
  if (!listing) return null
  const products = listing.inventory?.products
  if (!Array.isArray(products)) return listing.has_variations === false ? [] : null
  if (products.length === 0) return listing.has_variations === false ? [] : null
  for (const p of products) {
    if (!p || typeof p !== 'object') return null
    if (p.is_deleted) continue
    if (!Array.isArray(p.property_values) || !Array.isArray(p.offerings)) return null
    if (p.offerings.some(o => !o || typeof o !== 'object')) return null
    if (p.property_values.some(pv => !pv || typeof pv.property_name !== 'string' ||
      !pv.property_name.trim() || !Array.isArray(pv.values) || pv.values.length === 0 ||
      pv.values.some(value => typeof value !== 'string' || !value.trim()))) return null
    const offering = p.offerings.find(o => o && !o.is_deleted)
    if (!offering || !Number.isInteger(offering.quantity) || offering.quantity! < 0 ||
      typeof offering.is_enabled !== 'boolean' || !offering.price ||
      !Number.isFinite(offering.price.amount) || offering.price.amount < 0 ||
      !Number.isFinite(offering.price.divisor) || offering.price.divisor <= 0) return null
  }
  const out: ParsedVariation[] = []

  for (const p of products) {
    if (p.is_deleted) continue
    const offering = (p.offerings ?? []).find((o) => !o.is_deleted) ?? p.offerings?.[0]

    const options = (p.property_values ?? [])
      .map((pv) => ({ name: pv.property_name ?? '', value: (pv.values ?? []).join(', ') }))
      .filter((o) => o.name && o.value)

    if (options.length === 0) continue // no properties means there is nothing to choose

    out.push({
      etsyProductId: p.product_id != null ? String(p.product_id) : null,
      sku: p.sku ?? null,
      price: money(offering?.price),
      quantity: offering?.quantity ?? 0,
      isEnabled: offering?.is_enabled !== false,
      label: options.map((o) => o.value).join(' / '),
      options,
    })
  }

  if (listing.has_variations === true && out.length === 0) return null
  return out
}

export function money(m: EtsyMoney | undefined): number | null {
  if (!m || !m.divisor) return null
  return Math.round((m.amount / m.divisor) * 100) / 100
}

export interface EtsyReviewRow {
  shop_id?: number
  listing_id?: number | null
  transaction_id?: number | null
  rating?: number | null
  review?: string | null
  image_url_fullxfull?: string | null
  create_timestamp?: number | null
  created_timestamp?: number | null
}

// Reviews are fetched shop-wide rather than per listing: the shop endpoint is the
// only one that returns transaction_id (a stable dedupe key) alongside listing_id,
// and it costs one paged call instead of one per listing.
export async function fetchShopReviews(shopId: number): Promise<EtsyReviewRow[]> {
  const all: EtsyReviewRow[] = []
  const limit = 100
  let offset = 0

  for (;;) {
    const page = await etsyGet<{ count: number; results: EtsyReviewRow[] }>(
      `/shops/${shopId}/reviews?limit=${limit}&offset=${offset}`,
    )
    const results = page.results ?? []
    all.push(...results)
    offset += results.length
    if (results.length < limit || offset >= (page.count ?? 0)) break
    if (offset > 5000) break
  }

  return all
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

// Exhaust every page before callers can hide listings that disappeared.
export async function fetchShopListings(
  shopId: number,
  state: 'active' | 'draft',
  read: <T>(path: string) => Promise<T> = etsyGet,
): Promise<EtsyListing[]> {
  const all: EtsyListing[] = []
  let offset = 0
  for (;;) {
    const path = state === 'active'
      ? `/shops/${shopId}/listings/active?limit=100&offset=${offset}`
      : `/shops/${shopId}/listings?state=draft&limit=100&offset=${offset}`
    const page = await read<{ count: number; results: EtsyListing[] }>(path)
    if (!Array.isArray(page.results) || !Number.isSafeInteger(page.count) || page.count < 0 ||
        page.results.some(l => !Number.isSafeInteger(l.listing_id) ||
          (l.state !== state && !(state === 'draft' && l.state === 'edit'))))
      throw new Error(`Etsy ${state} listings response was incomplete or had an unexpected state`)
    all.push(...page.results)
    offset += page.results.length
    if (offset >= page.count) return all
    if (!page.results.length || offset >= 10000)
      throw new Error(`Etsy ${state} listings pagination was incomplete`)
  }
}
export async function fetchActiveListings(shopId: number): Promise<EtsyListing[]> {
  return fetchShopListings(shopId, 'active')
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
  includes = 'Images,Videos,Personalization',
  privateGet?: (path: string) => Promise<{ results: EtsyListing[] }>,
  metadataGet: (path: string) => Promise<{ results: EtsyListing[] }> = etsyGet,
): Promise<Map<number, EtsyListing>> {
  const details = new Map<number, EtsyListing>()
  for (let i = 0; i < listingIds.length; i += 100) {
    const ids = listingIds.slice(i, i + 100).join(',')
    const tasks = [metadataGet(`/listings/batch?listing_ids=${ids}&includes=${includes}`)]
    if (privateGet) tasks.push(
      privateGet(`/listings/batch/inventory?listing_ids=${ids}`),
      privateGet(`/listings/batch/shipping?listing_ids=${ids}`),
    )
    const results = await Promise.allSettled(tasks)
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') { console.error(`ETSY_DETAIL_ERR ${['metadata', 'inventory', 'shipping'][index]} ::`, result.reason instanceof Error ? result.reason.message : 'Request failed'); continue }
      for (const listing of result.value.results ?? []) {
        if (!Number.isSafeInteger(listing.listing_id)) continue
        const previous = details.get(listing.listing_id) ?? { listing_id: listing.listing_id }
        // Merge only each endpoint's own fields: a sparse inventory response
        // must not erase the gallery or metadata returned by the public request.
        const fields = index === 1 ? { inventory: listing.inventory } : index === 2 ? { shipping_profile: listing.shipping_profile } : listing
        details.set(listing.listing_id, { ...previous, ...fields } as EtsyListing)
      }
    }
  }
  return details
}

// Etsy ranks images; keep that order so the shop matches the Etsy gallery.
export function orderedImages(
  listing: EtsyListing | undefined,
): { url: string; fullUrl: string | null; etsyImageId: string | null }[] | null {
  if (!Array.isArray(listing?.images)) return null
  // Reject the entire replacement if even one image is malformed.
  const validUrl = (value: unknown) => {
    if (typeof value !== 'string') return false
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && url.hostname === 'i.etsystatic.com' &&
        !url.username && !url.password
    } catch { return false }
  }
  if (listing.images.some(img => !img ||
    !validUrl(img.url_570xN || img.url_fullxfull) ||
    (img.url_fullxfull != null && !validUrl(img.url_fullxfull)) ||
    (img.rank != null && (!Number.isInteger(img.rank) || img.rank < 0)) ||
    (img.listing_image_id != null && (!Number.isSafeInteger(img.listing_image_id) || img.listing_image_id <= 0)))) return null
  return [...listing.images]
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((img) => ({
      url: img.url_570xN || img.url_fullxfull || '',
      fullUrl: img.url_fullxfull ?? null,
      etsyImageId: img.listing_image_id != null ? String(img.listing_image_id) : null,
    }))
    .filter((img) => img.url)
}

// Etsy's per-colour photo assignments (empty for most listings). Maps a property
// value like "Army Blue" to a listing_image_id. Public endpoint (app key).
export async function fetchVariationImages(
  shopId: number,
  listingId: number,
  read: <T>(path: string) => Promise<T> = etsyGet,
): Promise<{ value: string; etsyImageId: string }[]> {
  try {
    const data = await read<{ results: { value: string; image_id: number }[] }>(
      `/shops/${shopId}/listings/${listingId}/variation-images`,
    )
    return (data.results ?? [])
      .filter((r) => r.image_id != null && r.value)
      .map((r) => ({ value: r.value, etsyImageId: String(r.image_id) }))
  } catch {
    return []
  }
}

// Etsy models shipping per destination. Prefer the origin country so a domestic
// buyer sees a domestic rate. Processing time is read from the listing (and only
// falls back to the profile), because the profile leaves it unset.
export function shippingSummary(base: EtsyListing, detail: EtsyListing | undefined) {
  const profile = detail?.shipping_profile
  const destinations = profile?.shipping_profile_destinations ?? []
  const origin = profile?.origin_country_iso ?? destinations[0]?.origin_country_iso ?? null
  const preferred =
    destinations.find((d) => origin && d.destination_country_iso === origin) ?? destinations[0]

  return {
    processingMin: base.processing_min ?? profile?.min_processing_days ?? null,
    processingMax: base.processing_max ?? profile?.max_processing_days ?? null,
    shipsFrom: origin,
    shippingCost: money(preferred?.primary_cost) ?? null,
    shippingMinDays: preferred?.min_delivery_days ?? null,
    shippingMaxDays: preferred?.max_delivery_days ?? null,
  }
}
