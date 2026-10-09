/** Gallery rows are ordered by Etsy rank by the caller. */
export function productThumbnail(product: {
  imageUrl: string | null
  images: readonly { url: string }[]
}): string | null {
  return product.imageUrl?.trim() || product.images.find(image => image.url.trim())?.url || null
}
