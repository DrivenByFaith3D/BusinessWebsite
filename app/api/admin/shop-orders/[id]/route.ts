import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerSession(authOptions)
  if (auth?.user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || !['paid', 'printing', 'shipped', 'delivered'].includes(body.status))
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  const fields: Record<string, string | null> = {}
  for (const name of ['carrier', 'trackingNumber', 'trackingUrl']) {
    if (body[name] != null && (typeof body[name] !== 'string' || body[name].length > 500))
      return NextResponse.json({ error: 'Invalid tracking details.' }, { status: 400 })
    fields[name] = body[name]?.trim() || null
  }
  if (fields.trackingUrl) {
    try {
      const url = new URL(fields.trackingUrl)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Tracking link must be a valid HTTPS URL.' }, { status: 400 })
    }
  }
  const order = await prisma.shopOrder.findUnique({ where: { id } })
  if (!order?.paidAt)
    return NextResponse.json({ error: 'Only paid orders can be fulfilled.' }, { status: 409 })
  await prisma.shopOrder.update({
    where: { id },
    data: {
      ...fields,
      status: body.status,
      shippedAt: ['shipped', 'delivered'].includes(body.status) ? (order.shippedAt ?? new Date()) : null,
    },
  })
  return NextResponse.json({ ok: true })
}
