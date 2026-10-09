import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'

// This suite is deliberately opt-in and refuses any non-loopback database.
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid')
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('/flow_test'))
  throw new Error('Integration tests require an isolated loopback flow_test database')
process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_placeholder'
const require = createRequire(`${process.cwd()}/package.json`)
require('next-auth/next').getServerSession = async () => null
const resource = new Stripe('sk_test_isolated_placeholder').checkout.sessions
const originalCreate = resource.constructor.prototype.create
const originalRetrieve = resource.constructor.prototype.retrieve
const sessions = new Map<string, Stripe.Checkout.Session>()
const idempotent = new Map<string, Stripe.Checkout.Session>()
resource.constructor.prototype.create = async (
  params: Stripe.Checkout.SessionCreateParams,
  options: { idempotencyKey: string },
) => {
  if (idempotent.has(options.idempotencyKey)) return idempotent.get(options.idempotencyKey)
  const id = `cs_test_${randomUUID().replaceAll('-', '')}`
  const subtotal = params.line_items!.reduce(
    (sum, i) => sum + (i.price_data!.unit_amount as number) * i.quantity!,
    0,
  )
  const session = {
    id,
    url: `https://checkout.stripe.com/${id}`,
    metadata: params.metadata,
    currency: 'usd',
    amount_subtotal: subtotal,
    amount_total: subtotal,
    status: 'open',
    payment_status: 'unpaid',
    total_details: { amount_tax: 0, amount_shipping: 0 },
    collected_information: null,
  } as unknown as Stripe.Checkout.Session
  sessions.set(id, session)
  idempotent.set(options.idempotencyKey, session)
  return session
}
resource.constructor.prototype.retrieve = async (id: string) => {
  const s = sessions.get(id)
  if (!s) throw new Error('Unknown mock session')
  return s
}
const { prisma } = require('./lib/prisma') as typeof import('../lib/prisma')
const { POST } =
  require('./app/api/stripe/product-checkout/route') as typeof import('../app/api/stripe/product-checkout/route')
const { applyCheckoutSession } = require('./lib/shop-payments') as typeof import('../lib/shop-payments')
const { saveEtsyProduct } = require('./lib/etsy-sync') as typeof import('../lib/etsy-sync')
async function checkout(
  productId: string,
  variationId: string | null,
  quantity: number,
  checkoutKey = randomUUID(),
  personalization?: string,
) {
  const response = await POST(
    new NextRequest('http://localhost/api/stripe/product-checkout', {
      method: 'POST',
      body: JSON.stringify({
        checkoutKey,
        cartItems: [{ productId, variationId, quantity, personalization }],
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  return { status: response.status, body: await response.json() }
}
before(async () => {
  await prisma.order.deleteMany()
  await prisma.user.deleteMany()
  await prisma.shopOrder.deleteMany()
  await prisma.stripeEvent.deleteMany()
  await prisma.product.deleteMany()
  await prisma.integrationSync.deleteMany()
})
after(async () => {
  resource.constructor.prototype.create = originalCreate
  resource.constructor.prototype.retrieve = originalRetrieve
  await prisma.$disconnect()
})

test('concurrent buyers cannot reserve the same final option, including duplicate retries', async () => {
  const product = await prisma.product.create({
    data: {
      name: 'Last print',
      price: 20,
      quantity: 1,
      variations: { create: { label: 'Blue', quantity: 1, etsyProductId: '123' } },
    },
    include: { variations: true },
  })
  const key = randomUUID()
  const responses = await Promise.all([
    checkout(product.id, product.variations[0].id, 1, key),
    checkout(product.id, product.variations[0].id, 1, key),
  ])
  assert.equal(responses.filter((r) => r.status === 200).length, 2)
  assert.equal((await checkout(product.id, product.variations[0].id, 1)).status, 409)
  assert.equal(await prisma.shopOrder.count(), 1)
  assert.equal(responses[0].body.url, responses[1].body.url)
  const order = await prisma.shopOrder.findFirstOrThrow({ include: { items: true } })
  const paid = {
    ...sessions.get(order.stripeSessionId!)!,
    payment_status: 'paid',
    status: 'complete',
  } as Stripe.Checkout.Session
  sessions.set(paid.id, paid)
  const applied = await Promise.all([
    applyCheckoutSession(paid, 'evt_paid_1'),
    applyCheckoutSession(paid, 'evt_paid_1'),
    applyCheckoutSession(paid, 'evt_paid_2'),
  ])
  assert.equal(applied.filter(Boolean).length, 1)
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).quantity, 0)
  assert.equal(
    (await prisma.productVariation.findUniqueOrThrow({ where: { id: product.variations[0].id } })).quantity,
    0,
  )
  assert.equal(await prisma.stripeEvent.count(), 2)
  await prisma.shopOrder.update({ where: { id: order.id }, data: { status: 'shipped' } })
  await applyCheckoutSession(paid, 'evt_paid_3')
  assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).status, 'shipped')
  await saveEtsyProduct(prisma, 'listing-1', false, { name: 'Sync fixture', price: 20, quantity: 2 }, null, [
    { etsyProductId: '456', sku: null, price: 20, label: 'Blue', quantity: 2, isEnabled: true, options: [] },
  ])
})

test('expired session releases stock, but a paid session still awaits recorded fulfillment', async () => {
  const p = await prisma.product.create({ data: { name: 'Expiry print', price: 10, quantity: 1 } })
  assert.equal((await checkout(p.id, null, 1)).status, 200)
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { items: { some: { productId: p.id } } } })
  await prisma.shopOrder.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  sessions.set(order.stripeSessionId!, { ...sessions.get(order.stripeSessionId!)!, status: 'expired' })
  assert.equal((await checkout(p.id, null, 1)).status, 200)
  assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).status, 'expired')
})

test('personalization and stable option IDs survive sync; website sales stay deducted', async () => {
  const p = await prisma.product.create({
    data: {
      name: 'Personal print',
      price: 10,
      quantity: 5,
      etsyListingId: 'personal',
      isPersonalizable: true,
      variations: { create: { label: 'Red', quantity: 5, etsyProductId: 'stable-red' } },
    },
    include: { variations: true },
  })
  assert.equal((await checkout(p.id, p.variations[0].id, 1)).status, 409)
  const result = await checkout(p.id, p.variations[0].id, 2, randomUUID(), 'Taylor')
  assert.equal(result.status, 200)
  const order = await prisma.shopOrder.findFirstOrThrow({
    where: { items: { some: { productId: p.id } } },
    include: { items: true },
  })
  assert.equal(order.items[0].personalization, 'Taylor')
  await applyCheckoutSession(
    { ...sessions.get(order.stripeSessionId!)!, payment_status: 'paid', status: 'complete' },
    'evt_personal',
  )
  await saveEtsyProduct(
    prisma,
    'personal',
    true,
    { name: 'Personal print', price: 10, quantity: 5, inStock: true },
    null,
    [
      {
        etsyProductId: 'stable-red',
        sku: null,
        price: 10,
        label: 'Red',
        quantity: 5,
        isEnabled: true,
        options: [],
      },
    ],
  )
  const synced = await prisma.product.findUniqueOrThrow({
    where: { id: p.id },
    include: { variations: true },
  })
  assert.equal(synced.variations[0].id, p.variations[0].id)
  assert.equal(synced.quantity, 3)
  assert.equal(synced.variations[0].quantity, 3)
})

test('unlimited made-to-order stock stays nullable after payment', async () => {
  const p = await prisma.product.create({ data: { name: 'Made to order', price: 10 } })
  assert.equal((await checkout(p.id, null, 2)).status, 200)
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { items: { some: { productId: p.id } } } })
  await applyCheckoutSession(
    { ...sessions.get(order.stripeSessionId!)!, payment_status: 'paid', status: 'complete' },
    'evt_unlimited',
  )
  const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
  assert.equal(after.quantity, null)
  assert.equal(after.inStock, true)
})

test('different simultaneous buyers compete for one remaining unit', async () => {
  const product = await prisma.product.create({ data: { name: 'Contended print', price: 12, quantity: 1 } })
  const results = await Promise.all([checkout(product.id, null, 1), checkout(product.id, null, 1)])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
  assert.equal(
    await prisma.shopOrder.count({
      where: { items: { some: { productId: product.id } }, status: 'pending' },
    }),
    1,
  )
})
test('delayed paid webhook never frees already paid inventory during reservation cleanup', async () => {
  const p = await prisma.product.create({ data: { name: 'Delayed payment print', price: 10, quantity: 1 } })
  assert.equal((await checkout(p.id, null, 1)).status, 200)
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { items: { some: { productId: p.id } } } })
  await prisma.shopOrder.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  sessions.set(order.stripeSessionId!, {
    ...sessions.get(order.stripeSessionId!)!,
    status: 'complete',
    payment_status: 'paid',
  })
  assert.equal((await checkout(p.id, null, 1)).status, 409)
  assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).status, 'paid')
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity, 0)
})
test('mismatched amounts roll back payment state and event marker together', async () => {
  const p = await prisma.product.create({ data: { name: 'Amount guard', price: 10, quantity: 1 } })
  await checkout(p.id, null, 1)
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { items: { some: { productId: p.id } } } })
  await assert.rejects(
    applyCheckoutSession(
      { ...sessions.get(order.stripeSessionId!)!, payment_status: 'paid', amount_subtotal: 1 },
      'evt_wrong_amount',
    ),
    /amount does not match/,
  )
  assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).status, 'pending')
  assert.equal(await prisma.stripeEvent.count({ where: { id: 'evt_wrong_amount' } }), 0)
})
test('custom order duplicate events preserve shipped status; old expiry cannot clear a newer session', async () => {
  const user = await prisma.user.create({
    data: { email: 'isolated@example.invalid', password: 'not-a-real-login' },
  })
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      description: 'Custom fixture',
      quote: 30,
      status: 'in_transit',
      stripeSessionId: 'cs_test_custom_current',
    },
  })
  const paid = {
    id: 'cs_test_custom_current',
    metadata: { orderId: order.id },
    payment_status: 'paid',
    status: 'complete',
    total_details: { amount_tax: 100 },
  } as unknown as Stripe.Checkout.Session
  await Promise.all([
    applyCheckoutSession(paid, 'evt_custom_paid'),
    applyCheckoutSession(paid, 'evt_custom_paid'),
  ])
  assert.equal(await prisma.orderEvent.count({ where: { orderId: order.id, type: 'payment_received' } }), 1)
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'in_transit')
  await applyCheckoutSession(
    { ...paid, id: 'cs_test_custom_old', payment_status: 'unpaid', status: 'expired' },
    'evt_custom_old_expired',
  )
  assert.equal(
    (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).stripeSessionId,
    'cs_test_custom_current',
  )
})

test('sync health persists partial/failure results and rejects overlapping runs', async () => {
  const { trackSync } = require('./lib/integration-health') as typeof import('../lib/integration-health')
  let finish!: () => void
  const gate = new Promise<void>((resolve) => {
    finish = resolve
  })
  const first = trackSync('isolated-sync', async () => {
    await gate
    return { partial: false }
  })
  // Wait for the persisted running marker, without relying on an arbitrary delay.
  for (let i = 0; i < 100; i++) {
    if ((await prisma.integrationSync.findUnique({ where: { key: 'isolated-sync' } }))?.status === 'running')
      break
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
  await assert.rejects(
    trackSync('isolated-sync', async () => ({ partial: false })),
    /already running/,
  )
  finish()
  await first
  const success = await prisma.integrationSync.findUniqueOrThrow({ where: { key: 'isolated-sync' } })
  await trackSync('isolated-sync', async () => ({ partial: true }))
  const partial = await prisma.integrationSync.findUniqueOrThrow({ where: { key: 'isolated-sync' } })
  assert.equal(partial.status, 'partial')
  assert.equal(partial.lastSuccessAt?.getTime(), success.lastSuccessAt?.getTime())
  await assert.rejects(
    trackSync('isolated-sync', async () => {
      throw new Error('upstream failure')
    }),
  )
  assert.equal(
    (await prisma.integrationSync.findUniqueOrThrow({ where: { key: 'isolated-sync' } })).status,
    'failed',
  )
  await trackSync('isolated-sync', async () => ({ partial: false }))
  assert.equal(
    (await prisma.integrationSync.findUniqueOrThrow({ where: { key: 'isolated-sync' } })).status,
    'ok',
  )
})
test('webhook validates signatures, commits a payment once and returns 500 on failed recording', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_isolated_test_only'
  const { POST: webhook } =
    require('./app/api/stripe/webhook/route') as typeof import('../app/api/stripe/webhook/route')
  const p = await prisma.product.create({ data: { name: 'Webhook fixture', price: 10, quantity: 2 } })
  await checkout(p.id, null, 1)
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { items: { some: { productId: p.id } } } })
  const stripe = new Stripe('sk_test_isolated_placeholder')
  const payload = JSON.stringify({
    id: 'evt_signed_fixture',
    type: 'checkout.session.completed',
    data: {
      object: { ...sessions.get(order.stripeSessionId!)!, status: 'complete', payment_status: 'paid' },
    },
  })
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  })
  const request = (body: string, sig: string) =>
    new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body,
      headers: { 'stripe-signature': sig },
    })
  assert.equal((await webhook(request(payload, 'invalid'))).status, 400)
  assert.equal((await webhook(request(payload, signature))).status, 200)
  assert.equal((await webhook(request(payload, signature))).status, 200)
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity, 1)
  const badPayload = JSON.stringify({
    id: 'evt_signed_missing_order',
    type: 'checkout.session.completed',
    data: {
      object: {
        ...sessions.get(order.stripeSessionId!)!,
        metadata: { shopOrderId: 'does-not-exist' },
        payment_status: 'paid',
      },
    },
  })
  const badSignature = stripe.webhooks.generateTestHeaderString({
    payload: badPayload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  })
  assert.equal((await webhook(request(badPayload, badSignature))).status, 500)
  assert.equal(await prisma.stripeEvent.count({ where: { id: 'evt_signed_missing_order' } }), 0)
})
