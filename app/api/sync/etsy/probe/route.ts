import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// TEMPORARY: reports the shape of Etsy's listing response so the sync can be built
// against what the API actually returns. Reports structure only, never secrets.
// Remove once the shop detail sync is finalised.
export const dynamic = 'force-dynamic'

const API = 'https://openapi.etsy.com/v3/application'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const key = `${process.env.ETSY_KEYSTRING?.trim()}:${process.env.ETSY_SHARED_SECRET?.trim()}`
  const shop = process.env.ETSY_SHOP_NAME?.trim()
  const get = async (path: string) => {
    const r = await fetch(`${API}${path}`, { headers: { 'x-api-key': key }, cache: 'no-store' })
    return { status: r.status, text: await r.text() }
  }

  const out: Record<string, unknown> = {}

  const shopRes = await get(`/shops?shop_name=${encodeURIComponent(shop ?? '')}`)
  if (shopRes.status !== 200) {
    return NextResponse.json({ step: 'shop lookup', status: shopRes.status, body: shopRes.text.slice(0, 200) })
  }
  const shopId = JSON.parse(shopRes.text).results[0].shop_id
  out.shopId = shopId

  const listRes = await get(`/shops/${shopId}/listings/active?limit=1`)
  const firstId = JSON.parse(listRes.text).results?.[0]?.listing_id
  out.firstListingId = firstId

  for (const inc of ['Images', 'Images,Shipping', 'Images,Shipping,Inventory,Videos']) {
    const r = await get(`/listings/batch?listing_ids=${firstId}&includes=${inc}`)
    if (r.status !== 200) {
      out[inc] = { status: r.status, body: r.text.slice(0, 160) }
      continue
    }
    const l = JSON.parse(r.text).results?.[0] ?? {}
    const sp = l.shipping_profile
    out[inc] = {
      status: 200,
      keys: Object.keys(l),
      imageCount: (l.images ?? []).length,
      imageFields: l.images?.[0] ? Object.keys(l.images[0]) : null,
      hasShippingProfile: !!sp,
      shippingKeys: sp ? Object.keys(sp) : null,
      processingDays: sp ? [sp.min_processing_days, sp.max_processing_days] : null,
      destinationCount: sp?.shipping_profile_destinations?.length ?? null,
      destinationSample: sp?.shipping_profile_destinations?.[0] ?? null,
    }
  }

  return NextResponse.json(out)
}
