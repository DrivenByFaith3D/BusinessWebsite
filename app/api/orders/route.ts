import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { sendEmail, newOrderEmailHtml } from '@/lib/brevo'
import { formatOrderId } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'
import { logOrderEvent } from '@/lib/events'
import { adminNotifyEmails } from '@/lib/notify'

const TYPE_PREFIX: Record<string, string> = {
  stl: 'STL',
  image: 'IMG',
  scratch: 'SCR',
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { success } = await rateLimit(`order:${session.user.id}`, 10, 60 * 60_000)
  if (!success) return NextResponse.json({ error: 'Too many orders submitted. Try again later.' }, { status: 429 })

  const { description, orderType, quantity } = await req.json()
  if (!description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })

  const type = orderType && TYPE_PREFIX[orderType] ? orderType : 'stl'
  const prefix = TYPE_PREFIX[type]

  // Count existing orders of this type to get next sequential number
  const count = await prisma.order.count({ where: { orderType: type } })
  const orderNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      description: description.trim(),
      status: 'pending',
      orderType: type,
      orderNumber,
      quantity: quantity && quantity > 0 ? parseInt(quantity) : 1,
    },
  })
  await logOrderEvent(order.id, 'order_created', 'Order submitted')

  // Post an automatic welcome message from the admin account
  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (adminUser) {
    await prisma.message.create({
      data: {
        orderId: order.id,
        senderId: adminUser.id,
        content: `Thank you for your message! We've received it and will review it shortly. We'll reach out to discuss details, pricing, and timeline. We appreciate your interest! 🙏`,
      },
    })

    // Email admin about the new order
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const htmlContent = newOrderEmailHtml(
        order.id,
        formatOrderId(order),
        type,
        description.trim(),
        session.user.email,
        appUrl
      )
      for (const to of await adminNotifyEmails()) {
        await sendEmail({
          to,
          subject: `New order: ${formatOrderId(order)}`,
          htmlContent,
        })
      }
    } catch (e) {
      console.error('New order email failed:', e)
    }
  }

  return NextResponse.json(order)
}
