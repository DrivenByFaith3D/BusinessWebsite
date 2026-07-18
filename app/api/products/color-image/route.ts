import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api'

// Admin sets (or clears) which photo represents a colour. Stored as source=admin,
// which the Etsy sync will not overwrite.
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { productId, value, etsyImageId } = await req.json().catch(() => ({}))
  if (!productId || typeof value !== 'string' || !value) {
    return NextResponse.json({ error: 'Missing product or colour.' }, { status: 400 })
  }

  // Clearing the mapping.
  if (!etsyImageId) {
    await prisma.productColorImage.deleteMany({ where: { productId, value } })
    return NextResponse.json({ ok: true, cleared: true })
  }

  // The chosen photo must belong to this product.
  const image = await prisma.productImage.findFirst({
    where: { productId, etsyImageId: String(etsyImageId) },
    select: { id: true },
  })
  if (!image) return NextResponse.json({ error: 'That photo is not on this product.' }, { status: 400 })

  await prisma.productColorImage.upsert({
    where: { productId_value: { productId, value } },
    create: { productId, value, etsyImageId: String(etsyImageId), source: 'admin' },
    update: { etsyImageId: String(etsyImageId), source: 'admin' },
  })

  return NextResponse.json({ ok: true })
}
