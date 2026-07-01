import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { purchaseLabel } from '@/lib/shippo'
import { requireAdmin } from '@/lib/api'
import { sendEmail, statusChangeEmailHtml } from '@/lib/brevo'
import { formatOrderId } from '@/lib/constants'
import { logOrderEvent } from '@/lib/events'

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const { orderId, rateId, carrier } = body

  try {
    const transaction = await purchaseLabel(rateId)

    if (transaction.status !== 'SUCCESS') {
      return NextResponse.json({ error: 'Failed to purchase label' }, { status: 422 })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'label_created',
        trackingNumber: transaction.tracking_number,
        carrier: carrier?.toLowerCase() || 'usps',
        trackingUrl: transaction.tracking_url_provider,
        trackingStatus: 'label_created',
        labelUrl: transaction.label_url,
      },
      include: { user: { select: { email: true, name: true } } },
    })
    await logOrderEvent(orderId, 'label_created', `Shipping label created, ${transaction.tracking_number}`)

    // Email customer that their order has shipped
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const email = statusChangeEmailHtml(orderId, formatOrderId(order), 'label_created', appUrl)
      if (email) {
        await sendEmail({
          to: order.user.email,
          toName: order.user.name ?? undefined,
          subject: email.subject,
          htmlContent: email.html,
        })
      }
    } catch (e) {
      console.error('Label email failed:', e)
    }

    return NextResponse.json({ tracking_number: transaction.tracking_number, label_url: transaction.label_url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
