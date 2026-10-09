import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCheckoutLines, cartLineKey, remainingCart, assertAvailable } from '../lib/checkout-lines'
import { customAction, shopAction, etsyAction } from '../lib/order-inbox'

test('personalization separates cart lines; exact duplicates combine', () => {
  const lines = parseCheckoutLines([
    { productId: 'p', variationId: 'v', quantity: 1, personalization: ' Alex ' },
    { productId: 'p', variationId: 'v', quantity: 2, personalization: 'Alex' },
    { productId: 'p', variationId: 'v', quantity: 1, personalization: 'Sam' },
  ])
  assert.equal(lines.length, 2)
  assert.equal(lines[0].quantity, 3)
  assert.equal(lines[0].personalization, 'Alex')
  assert.notEqual(lines[0].cartKey, lines[1].cartKey)
  assert.equal(cartLineKey('p', 'v'), 'p::v') // legacy carts keep their keys
})
test('invalid quantities and oversized personalizations fail without silently changing an order', () => {
  for (const quantity of [0, -1, 1.5, 100, NaN, '2'])
    assert.throws(() => parseCheckoutLines([{ productId: 'p', quantity }]))
  assert.throws(() =>
    parseCheckoutLines([
      { productId: 'p', quantity: 99 },
      { productId: 'p', quantity: 1 },
    ]),
  )
  assert.throws(() => parseCheckoutLines([{ productId: 'p', quantity: 1, personalization: 'x'.repeat(501) }]))
})
test('stock check accounts for requested quantity and other reservations', () => {
  assertAvailable('Print', 2, 3, 1)
  assert.throws(() => assertAvailable('Print', 3, 3, 1), /Only 2/)
  assert.throws(() => assertAvailable('Print', 1, 0, 0), /Only 0/)
  assertAvailable('Made to order', 99, null, 500)
})
test('confirmed purchase removes only purchased quantities and leaves newly added items', () => {
  assert.deepEqual(
    remainingCart(
      [
        { key: 'blue', quantity: 4 },
        { key: 'new', quantity: 1 },
        { key: 'red', quantity: 1 },
      ],
      [
        { cartKey: 'blue', quantity: 2 },
        { cartKey: 'red', quantity: 1 },
      ],
    ),
    [
      { key: 'blue', quantity: 2 },
      { key: 'new', quantity: 1 },
    ],
  )
})
test('inbox next steps reflect channel, payment, production and delivery', () => {
  assert.equal(customAction({ status: 'pending', quote: null, paymentStatus: null }), 'Needs quote')
  assert.equal(customAction({ status: 'pending', quote: 30, paymentStatus: null }), 'Awaiting payment')
  assert.equal(customAction({ status: 'in_progress', quote: 30, paymentStatus: 'paid' }), 'Ready to ship')
  assert.equal(shopAction('paid'), 'Ready to print')
  assert.equal(shopAction('printing'), 'Ready to ship')
  assert.equal(shopAction('payment_failed'), 'Payment issue')
  assert.equal(shopAction('delivered'), 'Completed')
  assert.equal(etsyAction({ isPaid: true, isShipped: false, status: 'paid' }), 'Ready to ship')
  assert.equal(etsyAction({ isPaid: true, isShipped: false, status: 'canceled' }), 'Cancelled')
})
