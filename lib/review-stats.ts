export function overallReviewAverage(products: readonly { avgRating: number; reviewCount: number }[]): number | null {
  const count = products.reduce((sum, product) => sum + product.reviewCount, 0)
  return count ? products.reduce((sum, product) => sum + product.avgRating * product.reviewCount, 0) / count : null
}
