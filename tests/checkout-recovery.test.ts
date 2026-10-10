import { test } from 'node:test'
import assert from 'node:assert/strict'
import type Stripe from 'stripe'
import { findOrphanedSession } from '../lib/checkout-recovery'
import { missingEtsyScopes } from '../lib/etsy-scopes'
const order = { id: 'lost-order', createdAt: new Date(Date.now() - 60 * 60000), expiresAt: new Date(Date.now() - 29 * 60000) }
function stripe(list: (params: Stripe.Checkout.SessionListParams) => Promise<unknown>) {
  return { checkout: { sessions: { list } } } as unknown as Stripe
}
test('orphan recovery waits past expiration before releasing any reservation', async () => {
  const result = await findOrphanedSession(stripe(async () => { throw new Error('must not call') }), { ...order, expiresAt: new Date() })
  assert.equal(result.checked, false)
})
test('recovery finds a paid session on a later page rather than releasing its stock', async () => {
  let calls = 0
  const paid = { id: 'paid', payment_status: 'paid', metadata: { shopOrderId: order.id } }
  const result = await findOrphanedSession(stripe(async params => {
    calls++
    if (calls === 1) return { data: [{ id: 'unrelated', metadata: {} }], has_more: true }
    assert.equal(params.starting_after, 'unrelated')
    return { data: [paid], has_more: false }
  }), order)
  assert.equal(result.session, paid)
})
test('only a complete empty search confirms an abandoned reservation', async () => {
  const result = await findOrphanedSession(stripe(async () => ({ data: [], has_more: false })), order)
  assert.deepEqual(result, { checked: true, session: null })
})
test('Stripe outage or truncated pagination cannot release reserved stock', async () => {
  await assert.rejects(findOrphanedSession(stripe(async () => { throw new Error('outage') }), order), /outage/)
  await assert.rejects(findOrphanedSession(stripe(async () => ({ data: [], has_more: true })), order), /could not verify/)
})
test('scope checks flag old Etsy grants and accept the complete grant', () => {
  assert.deepEqual(missingEtsyScopes('transactions_r transactions_w'), ['listings_r', 'shops_r'])
  assert.deepEqual(missingEtsyScopes('transactions_r transactions_w listings_r shops_r'), [])
  assert.equal(missingEtsyScopes(null).length, 4)
})
