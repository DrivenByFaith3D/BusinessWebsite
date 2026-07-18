import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  })

  return NextResponse.json(reviews.map(r => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    imageUrl: r.imageUrl,
    verified: r.verified,
    createdAt: r.createdAt,
    userName: r.user.name ?? 'Customer',
  })))
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { productId, rating, comment, imageUrl } = await req.json()
  if (!productId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Verified buyer: this account has a paid shop order containing this product.
  const purchased = await prisma.shopOrderItem.findFirst({
    where: {
      productId,
      shopOrder: { userId: session.user.id, status: { in: ['paid', 'shipped', 'delivered'] } },
    },
    select: { id: true },
  })
  const verified = !!purchased
  const photo = typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null

  const review = await prisma.review.upsert({
    where: { productId_userId: { productId, userId: session.user.id } },
    create: { productId, userId: session.user.id, rating, comment: comment?.trim() || null, imageUrl: photo, verified },
    update: { rating, comment: comment?.trim() || null, imageUrl: photo, verified },
  })

  return NextResponse.json(review)
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  await prisma.review.deleteMany({
    where: { productId, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}
