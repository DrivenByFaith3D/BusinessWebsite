import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { sendEmail, newOrderEmailHtml } from '@/lib/brevo'
import { formatOrderId } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'
import { logOrderEvent } from '@/lib/events'
import { adminNotifyEmails } from '@/lib/notify'

// Contact form submissions land in the admin messaging system as a "contact" inquiry.
// Requires the user to be signed in so we can reply and keep them updated.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { success } = await rateLimit(`contact:${session.user.id}`, 5, 60 * 60_000)
  if (!success) return NextResponse.json({ error: 'Too many messages sent. Please try again later.' }, { status: 429 })

  const { messageType, message, name } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const type = (typeof messageType === 'string' && messageType.trim()) ? messageType.trim() : 'General Inquiry'
  const senderName = (typeof name === 'string' && name.trim()) ? name.trim() : (session.user.name || session.user.email)

  // Sequential CON-#### number
  const count = await prisma.order.count({ where: { orderType: 'contact' } })
  const orderNumber = `CON-${String(count + 1).padStart(4, '0')}`

  const description = `📩 Contact form, ${type}\n\nFrom: ${senderName} <${session.user.email}>\n\n${message.trim()}`

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      description,
      status: 'pending',
      orderType: 'contact',
      orderNumber,
    },
  })
  await logOrderEvent(order.id, 'order_created', 'Contact form message received')

  // Put the customer's message into the chat thread
  await prisma.message.create({
    data: { orderId: order.id, senderId: session.user.id, content: message.trim() },
  })

  // Auto-acknowledge from the admin account so the customer sees a reply
  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (adminUser) {
    await prisma.message.create({
      data: {
        orderId: order.id,
        senderId: adminUser.id,
        content: `Thanks for reaching out! We've received your message and will get back to you within 24 hours. You can continue the conversation right here on this page. 🙏`,
      },
    })

    // Notify admin (non-blocking)
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const htmlContent = newOrderEmailHtml(order.id, formatOrderId(order), 'contact', description, session.user.email, appUrl)
      for (const to of await adminNotifyEmails()) {
        await sendEmail({
          to,
          subject: `New contact message: ${formatOrderId(order)} (${type})`,
          htmlContent,
        })
      }
    } catch (e) {
      console.error('Contact email failed:', e)
    }
  }

  return NextResponse.json({ ok: true, orderId: order.id })
}
