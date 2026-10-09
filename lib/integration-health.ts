import { prisma } from './prisma'
export async function trackSync<T extends { partial?: boolean }>(
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const now = new Date()
  await prisma.integrationSync.upsert({
    where: { key },
    create: { key, status: 'unknown', lastAttemptAt: now },
    update: {},
  })
  const claimed = await prisma.integrationSync.updateMany({
    where: {
      key,
      OR: [{ status: { not: 'running' } }, { lastAttemptAt: { lt: new Date(Date.now() - 15 * 60000) } }],
    },
    data: { status: 'running', lastAttemptAt: now, message: null },
  })
  if (!claimed.count) throw new Error('A sync is already running. Please wait for it to finish.')
  try {
    const result = await run()
    await prisma.integrationSync.update({
      where: { key },
      data: {
        status: result.partial ? 'partial' : 'ok',
        ...(result.partial ? {} : { lastSuccessAt: new Date() }),
        message: result.partial
          ? 'Some Etsy details were unavailable; saved data was retained. Retry the sync.'
          : null,
      },
    })
    return result
  } catch (error) {
    await prisma.integrationSync
      .update({
        where: { key },
        data: { status: 'failed', message: 'Sync failed. Check the Etsy connection and retry.' },
      })
      .catch(() => {})
    throw error
  }
}
export async function paymentHealth(status: 'ok' | 'failed', message?: string) {
  const now = new Date()
  await prisma.integrationSync.upsert({
    where: { key: 'stripe-payments' },
    create: {
      key: 'stripe-payments',
      status,
      lastAttemptAt: now,
      ...(status === 'ok' ? { lastSuccessAt: now } : {}),
      message,
    },
    update: {
      status,
      lastAttemptAt: now,
      ...(status === 'ok' ? { lastSuccessAt: now } : {}),
      message: message ?? null,
    },
  })
}
