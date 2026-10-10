import { createEtsyAuthedReader } from '@/lib/etsy-oauth'
import { trackSync } from '@/lib/integration-health'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { saveEtsyProduct } from '@/lib/etsy-sync'
import { sendEmail, backInStockEmailHtml } from '@/lib/brevo'
import {
  EtsyNotConfiguredError,
  etsyShopName,
  fetchActiveListings,
  fetchShopListings,
  fetchListingDetails,
  fetchVariationImages,
  listingPrice,
  orderedImages,
  fetchShopReviews,
  parseVariations,
  resolveShopId,
  shippingSummary,
} from '@/lib/etsy'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface SyncResult {
  created: number
  updated: number
  deactivated: number
  total: number
  drafts: number
  reviews: number
  partial: boolean
  warnings: string[]
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

// Email pending back-in-stock subscribers for a product that just restocked,
// then mark them notified so they aren't emailed again next sync.
async function notifyBackInStock(productId: string, productName: string): Promise<void> {
  const subs = await prisma.backInStockSubscription.findMany({
    where: { productId, notifiedAt: null },
    select: { id: true, email: true },
  })
  if (subs.length === 0) return

  const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()
  const productUrl = `${appUrl}/listings/${productId}`
  for (const sub of subs) {
    try {
      await sendEmail({
        to: sub.email,
        subject: `Back in stock: ${productName}`,
        htmlContent: backInStockEmailHtml(productName, productUrl),
      })
    } catch (e) {
      console.error('Back-in-stock email failed for', sub.email, e instanceof Error ? e.message : e)
    }
  }
  await prisma.backInStockSubscription.updateMany({
    where: { id: { in: subs.map((s) => s.id) } },
    data: { notifiedAt: new Date() },
  })
}

async function runSync(): Promise<SyncResult> {
  const shopId = await resolveShopId(etsyShopName())
  const reader = createEtsyAuthedReader()
  const active = await fetchActiveListings(shopId)
  const warnings: string[] = []
  let drafts: typeof active = []
  let draftsComplete = false
  try {
    drafts = await fetchShopListings(shopId, 'draft', reader)
    draftsComplete = true
  } catch {
    warnings.push('Draft listings could not be read. Saved drafts were retained; reconnect Etsy with listing read permission, then retry.')
  }
  // Draft metadata is private, so it must use the seller's OAuth grant too.
  const [activeDetails, draftDetails] = await Promise.all([
    fetchListingDetails(active.map(l => l.listing_id), undefined, reader),
    fetchListingDetails(drafts.map(l => l.listing_id), undefined, reader, reader),
  ])
  const details = new Map([...activeDetails, ...draftDetails])
  const activeIds = new Set(active.map(l => l.listing_id))
  const listings = [...active, ...drafts.filter(l => !activeIds.has(l.listing_id))]
  const seen: string[] = []
  let created = 0
  let updated = 0

  for (const listing of listings) {
    const etsyListingId = String(listing.listing_id)
    seen.push(etsyListingId)

    const detail = details.get(listing.listing_id)
    const gallery = orderedImages(detail)
    if (gallery === null) warnings.push(`Listing ${etsyListingId}: image details incomplete; saved gallery retained.`)
    const shipping = shippingSummary(listing, detail)
    const existing = await prisma.product.findUnique({ where: { etsyListingId } })
    const shippingComplete = detail?.shipping_profile !== undefined
    if (!shippingComplete) warnings.push(`Listing ${etsyListingId}: shipping details unavailable; saved shipping retained. Reconnect Etsy to grant the required read permissions.`)
    const variations = parseVariations(detail)
    if (variations === null) warnings.push(`Listing ${etsyListingId}: inventory incomplete; saved options retained. Reconnect Etsy to grant inventory read permission.`)

    const data = {
      name: listing.title || 'Untitled Etsy draft',
      listingState: listing.state === 'active' ? 'active' : 'draft',
      description: listing.description,
      price: listingPrice(listing),
      // Primary thumbnail; the grid and cart already read this field.
      // Missing image data must not erase an existing thumbnail.
      ...(gallery?.[0]?.url ? { imageUrl: gallery[0].url } : {}),
      // Etsy's "active" listings can still be sold out.
      quantity: listing.quantity,
      inStock: listing.state === 'active' && listing.quantity > 0 && (existing !== null || variations !== null),
      etsyUrl: listing.url,
      etsySyncedAt: new Date(),
      processingMin: shippingComplete ? shipping.processingMin : (existing?.processingMin ?? shipping.processingMin),
      processingMax: shippingComplete ? shipping.processingMax : (existing?.processingMax ?? shipping.processingMax),
      shipsFrom: shippingComplete ? shipping.shipsFrom : (existing?.shipsFrom ?? shipping.shipsFrom),
      shippingCost: shippingComplete ? shipping.shippingCost : (existing?.shippingCost ?? shipping.shippingCost),
      shippingMinDays: shippingComplete ? shipping.shippingMinDays : (existing?.shippingMinDays ?? shipping.shippingMinDays),
      shippingMaxDays: shippingComplete ? shipping.shippingMaxDays : (existing?.shippingMaxDays ?? shipping.shippingMaxDays),
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
      ...(variations !== null ? { hasVariations: variations.length > 0 } : {}),
    }

    const product = await saveEtsyProduct(prisma, etsyListingId, !!existing, data, gallery, variations)
    existing ? updated++ : created++

    // Restocked? Email everyone who asked to be told. Best-effort — never let a
    // notification failure abort the sync.
    if (existing && !existing.inStock && data.inStock) {
      try {
        await notifyBackInStock(product.id, product.name)
      } catch (e) {
        console.error('Back-in-stock notify failed:', e instanceof Error ? e.message : e)
      }
    }

    // Colour photos: if the seller assigned per-colour images on Etsy, mirror them
    // (source=etsy). Admin-set mappings (source=admin) are left untouched.
    try {
      const variationImages = await fetchVariationImages(shopId, listing.listing_id, listing.state === 'active' ? undefined : reader)
      for (const vi of variationImages) {
        const current = await prisma.productColorImage.findUnique({
          where: { productId_value: { productId: product.id, value: vi.value } },
          select: { source: true },
        })
        // Never clobber a hand-picked mapping with Etsy's.
        if (current?.source === 'admin') continue
        await prisma.productColorImage.upsert({
          where: { productId_value: { productId: product.id, value: vi.value } },
          create: { productId: product.id, value: vi.value, etsyImageId: vi.etsyImageId, source: 'etsy' },
          update: { etsyImageId: vi.etsyImageId, source: 'etsy' },
        })
      }
    } catch (e) {
      console.error('Variation-image sync failed:', e instanceof Error ? e.message : e)
    }
  }

  // Listings absent from a complete active/draft snapshot get hidden
  // rather than deleted, so past orders and reviews keep their product.
  // Hand-made products (etsyListingId null) are never touched.
  const { count: deactivated } = await prisma.product.updateMany({
    where: {
      etsyListingId: { not: null, notIn: seen },
      ...(draftsComplete ? {} : { listingState: { not: 'draft' } }),
      OR: [{ inStock: true }, { listingState: { not: 'inactive' } }],
    },
    data: { inStock: false, listingState: 'inactive' },
  })

  // After products exist, so reviews can be matched to them by listing id.
  // Non-fatal: a review failure should not sink a product sync.
  let reviews = 0
  try {
    reviews = await syncReviews(shopId)
  } catch (e) {
    warnings.push('Reviews could not be synced; saved reviews retained.')
    console.error('Etsy review sync failed:', e instanceof Error ? e.message : e)
  }

  return { created, updated, deactivated, total: listings.length, drafts: drafts.length, reviews, partial: warnings.length > 0, warnings }
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

// Scheduled run (Vercel Cron). Fail closed when no cron secret is configured.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await trackSync('etsy-products', runSync)) })
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
    return NextResponse.json({ ok: true, ...(await trackSync('etsy-products', runSync)) })
  } catch (e) {
    return failure(e)
  }
}
