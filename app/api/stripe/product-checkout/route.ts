import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { randomBytes, createHash } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializable } from '@/lib/transactions'
import { parseCheckoutLines, assertAvailable } from '@/lib/checkout-lines'
import { applyCheckoutSession, notifyShopPurchase } from '@/lib/shop-payments'
import { SHIPPING_COUNTRIES } from '@/lib/shipping-countries'
import { paymentHealth } from '@/lib/integration-health'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  let lines: ReturnType<typeof parseCheckoutLines>
  try {
    lines = parseCheckoutLines(body?.cartItems)
    if (typeof body.checkoutKey !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(body.checkoutKey))
      throw new Error('Please reopen your cart and try again.')
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid cart.' },
      { status: 400 },
    )
  }
  const auth = await getServerSession(authOptions)
  const userId = auth?.user?.id ?? null
  const email = auth?.user?.email ?? null
  const fingerprint = createHash('sha256').update(JSON.stringify({ lines, userId, email })).digest('hex')
  if (!process.env.STRIPE_SECRET_KEY)
    return NextResponse.json(
      { error: 'Checkout is temporarily unavailable. Your cart is saved.' },
      { status: 503 },
    )
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim())
  const expiresAt = new Date(Date.now() + 31 * 60 * 1000)
  try {
    // Release only sessions Stripe confirms expired; a delayed webhook must not
    // make paid stock available again. Pending sessions remain reserved on outages.
    const stale = await prisma.shopOrder.findMany({
      where: {
        status: 'pending',
        OR: [{ expiresAt: { lte: new Date() } }, { expiresAt: null, stripeSessionId: { not: null } }],
        items: { some: { productId: { in: lines.map((l) => l.productId) } } },
      },
      select: { stripeSessionId: true },
    })
    await Promise.all(
      stale.map(async (order) => {
        if (!order.stripeSessionId) return
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId)
        const changed = await applyCheckoutSession(session)
        if (changed)
          await notifyShopPurchase(changed).catch(() =>
            paymentHealth('failed', 'Payment recorded; a receipt email failed. Follow up in the inbox.'),
          )
      }),
    )
    const order = await serializable(async (tx) => {
      const existing = await tx.shopOrder.findUnique({
        where: { checkoutKey: body.checkoutKey },
        include: { items: true },
      })
      if (existing) {
        if (existing.checkoutFingerprint !== fingerprint)
          throw new Error('Your cart changed. Reopen it to start a new checkout.')
        if (existing.paidAt && existing.stripeSessionId) return existing
        if (existing.status !== 'pending' || !existing.expiresAt || existing.expiresAt <= new Date())
          throw new Error('This checkout has expired. Reopen your cart and try again.')
        return existing
      }
      const products = await tx.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
        include: { variations: true },
      })
      const pending = await tx.shopOrderItem.findMany({
        where: { productId: { in: lines.map((l) => l.productId) }, shopOrder: { status: 'pending', OR: [{ checkoutKey: { not: null } }, { stripeSessionId: { not: null } }] } },
      })
      const requested = new Map<string, number>()
      const resolved = lines.map((line) => {
        const p = products.find((p) => p.id === line.productId)
        if (!p || !p.inStock) throw new Error('An item is no longer available. Please update your cart.')
        const v = line.variationId ? p.variations.find((v) => v.id === line.variationId) : null
        if ((line.variationId && !v) || (p.variations.length && !v))
          throw new Error(`Please reselect an option for ${p.name}; its options have changed.`)
        if (v && (!v.isEnabled || v.quantity < 1)) throw new Error(`That option for ${p.name} is sold out.`)
        if (p.isPersonalizable && !line.personalization)
          throw new Error(`Please add personalization for ${p.name}.`)
        if (!p.isPersonalizable && line.personalization)
          throw new Error(`Personalization is unavailable for ${p.name}.`)
        const inventoryKey = v ? (v.etsyProductId ? `etsy:${v.etsyProductId}` : `local:${v.id}`) : 'base'
        const key = `${p.id}::${inventoryKey}`
        requested.set(key, (requested.get(key) ?? 0) + line.quantity)
        const reserved = pending
          .filter((i) => i.productId === p.id && i.inventoryKey === inventoryKey)
          .reduce((sum, i) => sum + i.quantity, 0)
        assertAvailable(
          `${p.name}${v ? ` (${v.label})` : ''}`,
          requested.get(key)!,
          v?.quantity ?? p.quantity,
          reserved,
        )
        const productRequested = lines
          .filter((l) => l.productId === p.id)
          .reduce((sum, l) => sum + l.quantity, 0)
        assertAvailable(
          p.name,
          productRequested,
          p.quantity,
          pending.filter((i) => i.productId === p.id).reduce((sum, i) => sum + i.quantity, 0),
        )
        const price = Math.round((v?.price ?? p.price) * 100) / 100
        if (!Number.isFinite(price) || price <= 0)
          throw new Error('An item needs an updated price before checkout.')
        return {
          productId: p.id,
          name: p.name,
          variation: v?.label ?? null,
          variationId: v?.id ?? null,
          inventoryKey,
          personalization: line.personalization,
          cartKey: line.cartKey,
          price,
          quantity: line.quantity,
        }
      })
      return tx.shopOrder.create({
        data: {
          orderNumber: `SHOP-${randomBytes(6).toString('hex').toUpperCase()}`,
          confirmationToken: randomBytes(24).toString('hex'),
          checkoutKey: body.checkoutKey,
          checkoutFingerprint: fingerprint,
          expiresAt,
          userId,
          email,
          total: Math.round(resolved.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100,
          items: { create: resolved },
        },
        include: { items: true },
      })
    })
    if (order.stripeSessionId) {
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId)
      if (session.payment_status === 'paid')
        return NextResponse.json({
          url: `${(process.env.NEXTAUTH_URL || 'https://www.drivenbyfaith3d.com').trim()}/checkout/success?session_id=${session.id}`,
        })
      if (session.status === 'open' && session.url) return NextResponse.json({ url: session.url })
      return NextResponse.json(
        { error: 'This checkout is complete or expired. Reopen your cart.' },
        { status: 409 },
      )
    }
    const appUrl = (process.env.NEXTAUTH_URL || 'https://www.drivenbyfaith3d.com').trim()
    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        mode: 'payment',
        expires_at: Math.floor(order.expiresAt!.getTime() / 1000),
        line_items: order.items.map((i) => ({
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(i.price * 100),
            tax_behavior: 'exclusive',
            product_data: {
              name: `${i.name}${i.variation ? ` (${i.variation})` : ''}`,
              ...(i.personalization ? { description: `Personalization: ${i.personalization}` } : {}),
              tax_code: 'txcd_99999999',
            },
          },
          quantity: i.quantity,
        })),
        ...(email ? { customer_email: email } : {}),
        billing_address_collection: 'required',
        shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
        ...(process.env.STRIPE_TAX_ENABLED === 'true' ? { automatic_tax: { enabled: true } } : {}),
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/listings?checkout=cancelled`,
        metadata: {
          shopOrderId: order.id,
          productName: order.items[0].name,
          itemCount: String(order.items.reduce((s, i) => s + i.quantity, 0)),
        },
      },
      { idempotencyKey: `shop-checkout-${order.id}` },
    )
    await prisma.shopOrder.update({ where: { id: order.id }, data: { stripeSessionId: session.id } })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      await paymentHealth('failed', 'A checkout could not be opened. Review Stripe and retry.').catch(
        () => {},
      )
      console.error('Product checkout Stripe failure:', error.type)
      return NextResponse.json(
        { error: 'Checkout is temporarily unavailable. Your cart is saved; please try again.' },
        { status: 502 },
      )
    }
    if (error instanceof Error && !('code' in error))
      return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Product checkout database failure')
    return NextResponse.json(
      { error: 'Could not reserve your items. Your cart is saved; please try again.' },
      { status: 503 },
    )
  }
}
