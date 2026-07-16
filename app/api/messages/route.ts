import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, newMessageEmailHtml } from '@/lib/brevo'
import { requireAuth } from '@/lib/api'
import { rateLimit } from '@/lib/rate-limit'
import { adminNotifyEmails } from '@/lib/notify'

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.user.role !== 'admin' && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const messages = await prisma.message.findMany({
    where: { orderId },
    include: { sender: { select: { email: true, role: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(messages.map((m) => ({
    id: m.id,
    orderId: m.orderId,
    senderId: m.senderId,
    content: m.content,
    fileUrl: m.fileUrl,
    createdAt: m.createdAt.toISOString(),
    senderEmail: m.sender.email,
    senderName: m.sender.name,
    senderRole: m.sender.role,
  })))
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { success } = rateLimit(`msg:${session.user.id}`, 30, 60_000)
  if (!success) return NextResponse.json({ error: 'Sending too fast. Please slow down.' }, { status: 429 })

  const { orderId, content, fileUrl } = await req.json()
  if (!orderId || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'admin'
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const message = await prisma.message.create({
    data: { orderId, senderId: session.user.id, content: content.trim(), fileUrl: fileUrl || null },
  })

  // Auto-advance to in_progress when admin manually replies to a pending order
  if (isAdmin && order.status === 'pending') {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'in_progress' } })
  }

  // Email notification (non-blocking)
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    if (isAdmin) {
      await sendEmail({
        to: order.user.email,
        subject: 'New message on your order',
        htmlContent: newMessageEmailHtml(orderId, appUrl),
      })
    } else {
      for (const to of await adminNotifyEmails()) {
        await sendEmail({
          to,
          subject: `New message on order #${orderId.slice(0, 8).toUpperCase()}`,
          htmlContent: newMessageEmailHtml(orderId, appUrl),
        })
      }
    }
  } catch (e) {
    console.error('Email failed:', e)
  }

  return NextResponse.json(message)
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { messageId, content } = await req.json()
  if (!messageId || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (message.senderId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: content.trim() },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const messageId = req.nextUrl.searchParams.get('messageId')
  if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })

  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (message.senderId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.message.delete({ where: { id: messageId } })

  return NextResponse.json({ ok: true })
}
