import type Stripe from 'stripe'

// A session may exist even when saving its ID failed. Search the whole creation
// window before declaring a reservation abandoned; errors keep stock reserved.
export async function findOrphanedSession(
  stripe: Stripe,
  order: { id: string; createdAt: Date; expiresAt: Date | null },
) {
  if (!order.expiresAt || order.expiresAt.getTime() + 5 * 60000 > Date.now())
    return { checked: false, session: null }
  let after: string | undefined
  for (let page = 0; page < 10; page++) {
    const result = await stripe.checkout.sessions.list({
      created: {
        gte: Math.floor(order.createdAt.getTime() / 1000) - 60,
        lte: Math.ceil(order.expiresAt.getTime() / 1000) + 60,
      },
      limit: 100,
      ...(after ? { starting_after: after } : {}),
    })
    const session = result.data.find(s => s.metadata?.shopOrderId === order.id)
    if (session) return { checked: true, session }
    if (!result.has_more) return { checked: true, session: null }
    after = result.data.at(-1)?.id
    if (!after) break
  }
  throw new Error('Checkout recovery could not verify all Stripe sessions. Please retry shortly.')
}
