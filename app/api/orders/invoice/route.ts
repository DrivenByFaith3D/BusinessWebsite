import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api'

// Admin edits the invoice: line-item label, notes, price, quantity, tax status.
export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const { orderId } = body
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (typeof body.invoiceItemLabel === 'string') data.invoiceItemLabel = body.invoiceItemLabel.trim() || null
  if (typeof body.invoiceNotes === 'string') data.invoiceNotes = body.invoiceNotes.trim() || null
  if (typeof body.taxExempt === 'boolean') data.taxExempt = body.taxExempt
  if (body.quote != null) {
    const q = Number(body.quote)
    if (!Number.isFinite(q) || q < 0) return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    data.quote = Math.round(q * 100) / 100
  }
  if (body.quantity != null) {
    const n = Math.floor(Number(body.quantity))
    if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    data.quantity = n
  }

  const order = await prisma.order.update({ where: { id: orderId }, data })
  return NextResponse.json({ ok: true, order })
}
