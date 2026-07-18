import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  EtsyNotConfiguredError,
  etsyShopName,
  fetchActiveListings,
  fetchListingDetails,
  listingPrice,
  orderedImages,
  fetchShopReviews,
  parseVariations,
  resolveShopId,
  shippingSummary,
} from '@/lib/etsy'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface SyncResult {
  created: number
  updated: number
  deactivated: number
  total: number
  reviews: number
}

// Mirror Etsy reviews and attach each to its product via the listing id. Reviews
// for listings that are no longer active are still stored; they just have no
// product to hang off.
async function syncReviews(shopId: number): Promise<number> {
  const rows = await fetchShopReviews(shopId)
  if (rows.length === 0) return 0

  const products = await prisma.product.findMany({
    where: { etsyListingId: { not: null } },
    select: { id: true, etsyListingId: true },
  })
  const byListing = new Map(products.map((p) => [p.etsyListingId, p.id]))

  let saved = 0
  for (const row of rows) {
    if (row.transaction_id == null || row.rating == null) continue
    const seconds = row.create_timestamp ?? row.created_timestamp
    const data = {
      etsyListingId: row.listing_id != null ? String(row.listing_id) : null,
      productId: row.listing_id != null ? byListing.get(String(row.listing_id)) ?? null : null,
      rating: row.rating,
      review: row.review?.trim() || null,
      imageUrl: row.image_url_fullxfull ?? null,
      reviewedAt: seconds ? new Date(seconds * 1000) : new Date(),
      syncedAt: new Date(),
    }
    await prisma.etsyReview.upsert({
      where: { transactionId: String(row.transaction_id) },
      create: { transactionId: String(row.transaction_id), ...data },
      update: data,
    })
    saved++
  }

  return saved
}

async function runSync(): Promise<SyncResult> {
  const shopId = await resolveShopId(etsyShopName())
  const listings = await fetchActiveListings(shopId)
  const details = await fetchListingDetails(listings.map((l) => l.listing_id))

  const seen: string[] = []
  let created = 0
  let updated = 0

  for (const listing of listings) {
    const etsyListingId = String(listing.listing_id)
    seen.push(etsyListingId)

    const detail = details.get(listing.listing_id)
    const gallery = orderedImages(detail)
    const shipping = shippingSummary(listing, detail)
    const variations = parseVariations(detail)

    const data = {
      name: listing.title,
      description: listing.description,
      price: listingPrice(listing),
      // Primary thumbnail; the grid and cart already read this field.
      imageUrl: gallery[0]?.url ?? null,
      // Etsy's "active" listings can still be sold out.
      inStock: listing.quantity > 0,
      etsyUrl: listing.url,
      etsySyncedAt: new Date(),
      processingMin: shipping.processingMin,
      processingMax: shipping.processingMax,
      shipsFrom: shipping.shipsFrom,
      shippingCost: shipping.shippingCost,
      shippingMinDays: shipping.shippingMinDays,
      shippingMaxDays: shipping.shippingMaxDays,
      tags: listing.tags ?? [],
      materials: listing.materials ?? [],
      whoMade: listing.who_made ?? null,
      whenMade: listing.when_made ?? null,
      itemWeight: listing.item_weight ?? null,
      itemWeightUnit: listing.item_weight_unit ?? null,
      itemLength: listing.item_length ?? null,
      itemWidth: listing.item_width ?? null,
      itemHeight: listing.item_height ?? null,
      itemDimensionsUnit: listing.item_dimensions_unit ?? null,
      isPersonalizable:
        detail?.personalization?.is_personalizable ?? listing.is_personalizable ?? false,
      personalizationInstructions: detail?.personalization?.personalization_instructions ?? null,
      numFavorers: listing.num_favorers ?? null,
      etsyViews: listing.views ?? null,
      hasVariations: variations.length > 0,
    }

    const existing = await prisma.product.findUnique({ where: { etsyListingId } })
    const product = existing
      ? await prisma.product.update({ where: { etsyListingId }, data })
      : await prisma.product.create({ data: { ...data, etsyListingId } })
    existing ? updated++ : created++

    // Replace gallery and variations wholesale: Etsy is the source of truth, and
    // reconciling individual rows is not worth the complexity at this size.
    if (gallery.length > 0) {
      await prisma.productImage.deleteMany({ where: { productId: product.id } })
      await prisma.productImage.createMany({
        data: gallery.map((img, rank) => ({
          productId: product.id,
          url: img.url,
          fullUrl: img.fullUrl,
          rank,
        })),
      })
    }

    await prisma.productVariation.deleteMany({ where: { productId: product.id } })
    if (variations.length > 0) {
      await prisma.productVariation.createMany({
        data: variations.map((v, rank) => ({
          productId: product.id,
          etsyProductId: v.etsyProductId,
          sku: v.sku,
          price: v.price,
          quantity: v.quantity,
          isEnabled: v.isEnabled,
          label: v.label,
          options: v.options,
          rank,
        })),
      })
    }
  }

  // Anything previously pulled from Etsy that is no longer active gets hidden
  // rather than deleted, so past orders and reviews keep their product.
  // Hand-made products (etsyListingId null) are never touched.
  const { count: deactivated } = await prisma.product.updateMany({
    where: {
      etsyListingId: { not: null, notIn: seen },
      inStock: true,
    },
    data: { inStock: false },
  })

  // After products exist, so reviews can be matched to them by listing id.
  // Non-fatal: a review failure should not sink a product sync.
  let reviews = 0
  try {
    reviews = await syncReviews(shopId)
  } catch (e) {
    console.error('Etsy review sync failed:', e instanceof Error ? e.message : e)
  }

  return { created, updated, deactivated, total: listings.length, reviews }
}

function failure(e: unknown) {
  if (e instanceof EtsyNotConfiguredError) {
    return NextResponse.json(
      { error: `${e.message}. Add it to the project's environment variables.` },
      { status: 503 },
    )
  }
  const message = e instanceof Error ? e.message : 'Etsy sync failed'
  console.error('Etsy sync failed:', message)
  return NextResponse.json({ error: message }, { status: 502 })
}

// Scheduled run (Vercel Cron). Protected by CRON_SECRET when one is configured.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TEMP: report the STRUCTURE of a receipt (field names + types only, never the
  // buyer's actual name/address/email) so the order sync can be built against the
  // real shape. Removed once Phase 2 lands.
  if (req.nextUrl.searchParams.get('probeReceipts') === '1') {
    try {
      const { getValidAccessToken, oauthHeaders } = await import('@/lib/etsy-oauth')
      const { shopId, accessToken } = await getValidAccessToken()
      const res = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts?limit=2&includes=Transactions`,
        { headers: oauthHeaders(accessToken), cache: 'no-store' },
      )
      const data = (await res.json()) as { count?: number; results?: Record<string, unknown>[] }
      const describe = (o: Record<string, unknown> | undefined) =>
        o
          ? Object.fromEntries(
              Object.entries(o).map(([k, v]) => [
                k,
                Array.isArray(v) ? `array[${v.length}]` : v === null ? 'null' : typeof v,
              ]),
            )
          : null
      const r0 = data.results?.[0]
      const txns = (r0?.transactions as Record<string, unknown>[] | undefined) ?? []
      return NextResponse.json({
        status: res.status,
        count: data.count ?? null,
        receiptKeys: describe(r0),
        transactionKeys: describe(txns[0]),
      })
    } catch (e) {
      return failure(e)
    }
  }

  try {
    return NextResponse.json({ ok: true, ...(await runSync()) })
  } catch (e) {
    return failure(e)
  }
}

// Manual "Sync now" from the admin products page.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await runSync()) })
  } catch (e) {
    return failure(e)
  }
}
