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

export interface EtsyListing {
  listing_id: number
  title: string
  description: string | null
  url: string | null
  state: string
  quantity: number
  price: { amount: number; divisor: number; currency_code: string }
  images?: { url_570xN?: string; url_fullxfull?: string }[]
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

export function listingImage(listing: EtsyListing): string | null {
  const img = listing.images?.[0]
  return img?.url_570xN ?? img?.url_fullxfull ?? null
}

// The active-listings endpoint ignores `includes=Images`, but the batch lookup
// honours it. Fetch in chunks of 100 rather than per listing. Images are cosmetic,
// so a failure here degrades to "no image" instead of failing the sync.
export async function fetchImagesFor(listingIds: number[]): Promise<Map<number, string>> {
  const images = new Map<number, string>()

  for (let i = 0; i < listingIds.length; i += 100) {
    const chunk = listingIds.slice(i, i + 100)
    try {
      const data = await etsyGet<{ results: EtsyListing[] }>(
        `/listings/batch?listing_ids=${chunk.join(',')}&includes=Images,Shipping`,
      )
      for (const listing of data.results ?? []) {
        // TEMP SHAPE PROBE — remove once the detail page sync is settled.
        const anyL = listing as unknown as Record<string, unknown>
        const sp = anyL.shipping_profile as Record<string, unknown> | undefined
        console.log('E_IMG count=' + (listing.images ?? []).length + ' fields=' + (listing.images?.[0] ? Object.keys(listing.images[0]).join('|') : 'none'))
        console.log('E_SHIP has=' + !!sp + ' keys=' + (sp ? Object.keys(sp).join('|') : 'none'))

        const url = listingImage(listing)
        if (url) images.set(listing.listing_id, url)
      }
    } catch (e) {
      console.error('ETSY_IMG_ERR ::', e instanceof Error ? e.message : String(e))
    }
  }

  return images
}
