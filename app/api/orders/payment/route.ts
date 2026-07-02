import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { logOrderEvent } from '@/lib/events'

// Customer + admin actions around check payment.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { orderId, action } = await req.json()
  if (!orderId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const isAdmin = session.user.role === 'admin'
  const isOwner = order.userId === session.user.id
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Customer action: elect to pay by check (full payment mailed, confirmed by admin)
  if (action === 'select_check') {
    if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'This order is already paid.' }, { status: 400 })
    const updated = await prisma.order.update({ where: { id: orderId }, data: { paymentMethod: 'check' } })
    return NextResponse.json({ ok: true, order: updated })
  }

  // Remaining actions are admin-only
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (action === 'mark_paid') {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        status: order.status === 'pending' ? 'in_progress' : order.status,
      },
    })
    await logOrderEvent(orderId, 'payment_received', 'Payment received in full (check)')
    return NextResponse.json({ ok: true, order: updated })
  }

  if (action === 'mark_unpaid') {
    // undo an accidental mark-paid
    const updated = await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'unpaid' } })
    return NextResponse.json({ ok: true, order: updated })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
