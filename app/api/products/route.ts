import { productThumbnail } from '@/lib/product-image'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api'

export async function GET() {
  const products = await prisma.product.findMany({
    where: { listingState: 'active' },
    orderBy: { createdAt: 'desc' },
    include: { images: { orderBy: { rank: 'asc' }, take: 1, select: { url: true } } },
  })
  return NextResponse.json(products.map(({ images, ...product }) => ({
    ...product, imageUrl: productThumbnail({ ...product, images }),
  })))
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { name, description, price, imageUrl } = await req.json()
  if (!name || !price) return NextResponse.json({ error: 'Name and price are required' }, { status: 400 })

  const product = await prisma.product.create({
    data: { name, description: description || null, price: parseFloat(price), imageUrl: imageUrl || null },
  })
  return NextResponse.json(product)
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id, name, description, price, imageUrl, inStock } = await req.json()
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description || null }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      ...(inStock !== undefined && { inStock }),
    },
  })
  return NextResponse.json(product)
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
