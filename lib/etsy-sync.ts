import type { Prisma, PrismaClient } from '@prisma/client'
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
  return db.$transaction(async tx => {
    const saved = exists
      ? await tx.product.update({ where: { etsyListingId }, data })
      : await tx.product.create({ data: { ...data, etsyListingId } })
    if (gallery && gallery.length > 0) {
      await tx.productImage.deleteMany({ where: { productId: saved.id } })
      await tx.productImage.createMany({
        data: gallery.map((img, rank) => ({ productId: saved.id, ...img, rank })),
      })
    }
    if (variations !== null) {
      await tx.productVariation.deleteMany({ where: { productId: saved.id } })
      if (variations.length > 0) {
        await tx.productVariation.createMany({
          data: variations.map((v, rank) => ({ productId: saved.id, ...v, rank })),
        })
      }
    }
    return saved
  })
}
