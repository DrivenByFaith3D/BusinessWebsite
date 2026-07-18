import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

// A shopper asks to be emailed when an out-of-stock item returns. Public (no
// login needed) but rate-limited by IP to prevent list-stuffing.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await rateLimit(`backinstock:${ip}`, 20, 60 * 60 * 1000)
  if (!success) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })

  const { productId, email } = await req.json().catch(() => ({}))
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!productId || !clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { inStock: true } })
  if (!product) return NextResponse.json({ error: 'Item not found.' }, { status: 404 })
  if (product.inStock) return NextResponse.json({ error: "This item is in stock — you can order it now." }, { status: 400 })

  // Re-subscribing (notifiedAt reset to null) is fine: they want the next alert.
  await prisma.backInStockSubscription.upsert({
    where: { productId_email: { productId, email: clean } },
    create: { productId, email: clean },
    update: { notifiedAt: null },
  })

  return NextResponse.json({ ok: true })
}
