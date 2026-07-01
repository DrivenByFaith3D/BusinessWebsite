import { NextRequest, NextResponse } from 'next/server'
import { getTrackingStatus } from '@/lib/shippo'
import { requireAuth } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { SHIPPO_STATUS_MAP } from '@/lib/constants'
import { sendEmail, statusChangeEmailHtml } from '@/lib/brevo'
import { formatOrderId } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const carrier = req.nextUrl.searchParams.get('carrier')
  const trackingNumber = req.nextUrl.searchParams.get('tracking_number')
  const orderId = req.nextUrl.searchParams.get('order_id')

  if (!carrier || !trackingNumber) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  try {
    const raw = await getTrackingStatus(carrier, trackingNumber)
    const shippoStatus = raw.tracking_status?.status

    // Auto-update order status based on Shippo tracking
    if (orderId && shippoStatus && SHIPPO_STATUS_MAP[shippoStatus]) {
      const newStatus = SHIPPO_STATUS_MAP[shippoStatus]
      try {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true, orderNumber: true, id: true, user: { select: { email: true, name: true } } },
        })
        // Only update + email if status actually changed
        if (order && order.status !== newStatus) {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: newStatus, trackingStatus: shippoStatus },
          })
          const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          const email = statusChangeEmailHtml(orderId, formatOrderId(order), newStatus, appUrl)
          if (email) {
            await sendEmail({
              to: order.user.email,
              toName: order.user.name ?? undefined,
              subject: email.subject,
              htmlContent: email.html,
            }).catch((e) => console.error('Tracking status email failed:', e))
          }
        }
      } catch { /* silent fail, don't block tracking response */ }
    }

    return NextResponse.json({
      carrier: raw.carrier,
      tracking_number: raw.tracking_number,
      status: shippoStatus || 'unknown',
      eta: raw.eta || null,
      tracking_url: raw.tracking_url_provider || null,
      tracking_history: (raw.tracking_history || []).map((e: {
        status: string; status_date: string;
        location?: { city?: string; state?: string; country?: string };
        status_details?: string
      }) => ({
        status: e.status,
        status_date: e.status_date,
        location: [e.location?.city, e.location?.state, e.location?.country].filter(Boolean).join(', '),
        description: e.status_details || e.status,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
