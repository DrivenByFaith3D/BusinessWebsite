import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EtsyNotConnectedError } from '@/lib/etsy-oauth'
import { fetchReceipts, receiptTotal, receiptTracking, variationLabel } from '@/lib/etsy-orders'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function runOrderSync() {
  const receipts = await fetchReceipts()

  // Map Etsy listing ids to our products so an order can link to its product page.
  const products = await prisma.product.findMany({
    where: { etsyListingId: { not: null } },
    select: { id: true, etsyListingId: true },
  })
  const productByListing = new Map(products.map((p) => [p.etsyListingId, p.id]))

  let saved = 0
  for (const r of receipts) {
    const tracking = receiptTracking(r)
    const seconds = r.create_timestamp ?? r.created_timestamp
    const data = {
      buyerName: r.name ?? null,
      status: r.status ?? null,
      isPaid: !!r.is_paid,
      isShipped: !!r.is_shipped,
      grandTotal: receiptTotal(r),
      currency: r.grandtotal?.currency_code ?? null,
      addrLine1: r.first_line ?? null,
      addrLine2: r.second_line ?? null,
      addrCity: r.city ?? null,
      addrState: r.state ?? null,
      addrZip: r.zip ?? null,
      addrCountry: r.country_iso ?? null,
      formattedAddress: r.formatted_address ?? null,
      messageFromBuyer: r.message_from_buyer ?? null,
      orderedAt: seconds ? new Date(seconds * 1000) : new Date(),
      syncedAt: new Date(),
    }

    const order = await prisma.etsyOrder.upsert({
      where: { receiptId: String(r.receipt_id) },
      // Don't clobber a Shippo-pushed tracking number with an empty Etsy one.
      create: {
        receiptId: String(r.receipt_id),
        ...data,
        trackingCode: tracking?.code ?? null,
        carrier: tracking?.carrier ?? null,
      },
      update: {
        ...data,
        ...(tracking ? { trackingCode: tracking.code, carrier: tracking.carrier } : {}),
      },
    })

    // Rebuild line items from the receipt each sync.
    await prisma.etsyOrderItem.deleteMany({ where: { etsyOrderId: order.id } })
    const txns = r.transactions ?? []
    if (txns.length > 0) {
      await prisma.etsyOrderItem.createMany({
        data: txns.map((t) => ({
          etsyOrderId: order.id,
          transactionId: String(t.transaction_id),
          title: t.title ?? 'Item',
          quantity: t.quantity ?? 1,
          price: t.price ? Math.round((t.price.amount / (t.price.divisor || 100)) * 100) / 100 : null,
          variations: variationLabel(t),
          listingId: t.listing_id != null ? String(t.listing_id) : null,
          productId: t.listing_id != null ? productByListing.get(String(t.listing_id)) ?? null : null,
        })),
      })
    }
    saved++
  }

  return { orders: saved }
}

function fail(e: unknown) {
  if (e instanceof EtsyNotConnectedError) {
    return NextResponse.json({ error: 'Etsy is not connected. Connect it first.' }, { status: 409 })
  }
  const message = e instanceof Error ? e.message : 'Etsy order sync failed'
  console.error('Etsy order sync failed:', message)
  return NextResponse.json({ error: message }, { status: 502 })
}

// Scheduled (cron) — protected by CRON_SECRET when set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await runOrderSync()) })
  } catch (e) {
    return fail(e)
  }
}

// Manual "Sync orders" from the admin Etsy orders page.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await runOrderSync()) })
  } catch (e) {
    return fail(e)
  }
}
