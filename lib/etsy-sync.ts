import { Prisma, type PrismaClient } from '@prisma/client'
import type { ParsedVariation } from './etsy'

type GalleryImage = { url: string; fullUrl: string | null; etsyImageId: string | null }

export async function saveEtsyProduct(
  db: Pick<PrismaClient, '$transaction'>,
  etsyListingId: string,
  exists: boolean,
  data: Omit<Prisma.ProductUncheckedCreateInput, 'etsyListingId'>,
  gallery: GalleryImage[] | null,
  variations: ParsedVariation[] | null,
) {
  // Metadata, gallery, and options commit together. A failed insert rolls back
  // every deletion and keeps the previous thumbnail and flags too.
  return db.$transaction(
    async (tx) => {
      const current = exists
        ? await tx.product.findUnique({ where: { etsyListingId }, select: { websiteSold: true } })
        : null
      const safeData = { ...data }
      if (typeof data.quantity === 'number') {
        safeData.quantity = Math.max(0, data.quantity - (current?.websiteSold ?? 0))
        safeData.inStock = !!data.inStock && safeData.quantity > 0
      }
      const saved = exists
        ? await tx.product.update({ where: { etsyListingId }, data: safeData })
        : await tx.product.create({ data: { ...safeData, etsyListingId } })
      if (gallery && gallery.length > 0) {
        await tx.productImage.deleteMany({ where: { productId: saved.id } })
        await tx.productImage.createMany({
          data: gallery.map((img, rank) => ({ productId: saved.id, ...img, rank })),
        })
      }
      if (variations !== null) {
        const previous = await tx.productVariation.findMany({ where: { productId: saved.id } })
        const keep: string[] = []
        for (const [rank, variation] of variations.entries()) {
          const match = variation.etsyProductId
            ? previous.find((v) => v.etsyProductId === variation.etsyProductId)
            : null
          const next = {
            ...variation,
            rank,
            quantity: Math.max(0, variation.quantity - (match?.websiteSold ?? 0)),
          }
          const row = match
            ? await tx.productVariation.update({ where: { id: match.id }, data: next })
            : await tx.productVariation.create({ data: { productId: saved.id, ...next } })
          keep.push(row.id)
        }
        await tx.productVariation.deleteMany({ where: { productId: saved.id, id: { notIn: keep } } })
      }
      return saved
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
