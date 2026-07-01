import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api'
import { sendEmail, quoteReadyEmailHtml } from '@/lib/brevo'
import { formatOrderId } from '@/lib/constants'
import { logOrderEvent } from '@/lib/events'

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { orderId, quote } = await req.json()
  if (!orderId || quote == null || isNaN(Number(quote)) || Number(quote) <= 0) {
    return NextResponse.json({ error: 'Invalid quote amount' }, { status: 400 })
  }

  const [order] = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { quote: Number(quote), paymentStatus: 'unpaid' },
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.quoteHistory.create({
      data: { orderId, amount: Number(quote) },
    }),
  ])
  await logOrderEvent(orderId, 'quote_set', `Quote set to $${Number(quote).toFixed(2)}`)

  // Email customer that their quote is ready
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    await sendEmail({
      to: order.user.email,
      toName: order.user.name ?? undefined,
      subject: 'Your quote is ready, DrivenByFaith3D',
      htmlContent: quoteReadyEmailHtml(orderId, formatOrderId(order), Number(quote), appUrl),
    })
  } catch (e) {
    console.error('Quote email failed:', e)
  }

  return NextResponse.json(order)
}
