import { prisma } from './prisma'

// Cross-instance sliding-ish rate limiter backed by Postgres. Because every
// serverless instance shares the same database, a per-window counter row gives
// real burst protection — unlike an in-memory map, which each instance keeps
// separately and resets on cold start.
//
// The window is bucketed: key = `${name}:${bucket}` where bucket = floor(now/window).
// We upsert-increment the row and compare against the limit. Rows carry an
// expiresAt so they can be swept; expired buckets simply start counting fresh.
export async function rateLimit(
  name: string,
  limit: number,
  windowMs: number,
): Promise<{ success: boolean; remaining: number }> {
  const now = Date.now()
  const bucket = Math.floor(now / windowMs)
  const key = `${name}:${bucket}`
  const expiresAt = new Date((bucket + 1) * windowMs)

  try {
    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    })
    return { success: row.count <= limit, remaining: Math.max(0, limit - row.count) }
  } catch {
    // Fail open on a transient DB hiccup rather than block a legitimate user.
    return { success: true, remaining: limit }
  }
}
