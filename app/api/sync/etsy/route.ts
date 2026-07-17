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
  parseVariations,
  probeReviews,
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

  return { created, updated, deactivated, total: listings.length }
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

  // TEMP: check whether Etsy exposes reviews without OAuth, and in what shape.
  // Public listing data only; removed once the review sync is settled.
  if (req.nextUrl.searchParams.get('probeReviews') === '1') {
    try {
      const shopId = await resolveShopId(etsyShopName())
      const listings = await fetchActiveListings(shopId)
      return NextResponse.json({
        shopId,
        listingId: listings[0]?.listing_id ?? null,
        byShop: await probeReviews(`/shops/${shopId}/reviews?limit=3`),
        byListing: await probeReviews(`/listings/${listings[0]?.listing_id}/reviews?limit=3`),
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
