import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api'
import { purchaseLabel } from '@/lib/shippo'
import { etsyCarrierName, pushTrackingToEtsy } from '@/lib/etsy-orders'
import { EtsyNotConnectedError } from '@/lib/etsy-oauth'

export const dynamic = 'force-dynamic'

// Two ways to mark an Etsy order shipped and push tracking back to Etsy:
//   - buy a Shippo label (rateId), or
//   - record a tracking number shipped elsewhere (trackingCode + carrier).
// Either way we call Etsy's createReceiptShipment, which notifies the buyer.
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { etsyOrderId, rateId, carrier, trackingCode, labelCost } = await req.json()
  if (!etsyOrderId) return NextResponse.json({ error: 'Missing etsyOrderId' }, { status: 400 })

  const order = await prisma.etsyOrder.findUnique({ where: { id: etsyOrderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  let finalTracking = typeof trackingCode === 'string' ? trackingCode.trim() : ''
  let finalCarrier = typeof carrier === 'string' ? carrier : ''
  let labelUrl: string | null = null
  let finalLabelCost: number | null = null

  try {
    // Path 1: buy the label through Shippo and take its tracking number.
    if (rateId) {
      const transaction = await purchaseLabel(rateId)
      if (transaction.status !== 'SUCCESS' || !transaction.tracking_number) {
        return NextResponse.json({ error: 'Failed to purchase label.' }, { status: 422 })
      }
      finalTracking = transaction.tracking_number
      finalCarrier = finalCarrier || 'usps'
      labelUrl = transaction.label_url ?? null
      // Prefer the amount Shippo actually charged; fall back to the picked rate.
      const charged = parseFloat(transaction.rate?.amount ?? '')
      const picked = parseFloat(typeof labelCost === 'string' || typeof labelCost === 'number' ? String(labelCost) : '')
      finalLabelCost = !Number.isNaN(charged) ? charged : !Number.isNaN(picked) ? picked : null
    }

    if (!finalTracking) {
      return NextResponse.json({ error: 'A tracking number or a chosen rate is required.' }, { status: 400 })
    }

    // Push to Etsy — marks shipped there and emails the buyer.
    await pushTrackingToEtsy(order.receiptId, finalTracking, etsyCarrierName(finalCarrier))

    const updated = await prisma.etsyOrder.update({
      where: { id: etsyOrderId },
      data: {
        isShipped: true,
        trackingCode: finalTracking,
        carrier: etsyCarrierName(finalCarrier),
        ...(labelUrl ? { labelUrl } : {}),
        ...(finalLabelCost != null ? { labelCost: finalLabelCost } : {}),
      },
    })

    return NextResponse.json({ ok: true, trackingCode: updated.trackingCode, labelUrl: updated.labelUrl })
  } catch (e) {
    if (e instanceof EtsyNotConnectedError) {
      return NextResponse.json({ error: 'Etsy is not connected. Reconnect it and try again.' }, { status: 409 })
    }
    // If the label bought but Etsy push failed, say so — the label still exists.
    const message = e instanceof Error ? e.message : 'Shipping failed'
    console.error('Etsy ship failed:', message)
    return NextResponse.json(
      { error: labelUrl ? `Label bought, but pushing tracking to Etsy failed: ${message}` : message, labelUrl },
      { status: 502 },
    )
  }
}
