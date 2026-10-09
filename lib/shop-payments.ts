import { randomBytes } from 'node:crypto'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { serializable } from './transactions'
import { prisma } from './prisma'
import { sendEmail } from './brevo'
import { adminNotifyEmails } from './notify'

export async function applyCheckoutSession(
  session: Stripe.Checkout.Session,
  eventId?: string,
  failed = false,
) {
  return serializable(async (tx) => {
    if (eventId && (await tx.stripeEvent.findUnique({ where: { id: eventId } }))) return null
    const paid = session.payment_status === 'paid'
    const shopOrderId = session.metadata?.shopOrderId
    const orderId = session.metadata?.orderId
    let changed: string | null = null
    if (shopOrderId) {
      const order = await tx.shopOrder.findUniqueOrThrow({
        where: { id: shopOrderId },
        include: { items: true },
      })
      if (order.stripeSessionId && order.stripeSessionId !== session.id)
        throw new Error('Payment session does not match order')
      if (paid && !order.paidAt) {
        if (session.currency !== 'usd' || session.amount_subtotal !== Math.round(order.total * 100))
          throw new Error('Payment amount does not match order')
        const updated = await tx.shopOrder.updateMany({
          where: { id: order.id, paidAt: null },
          data: {
            status: 'paid',
            confirmationToken: order.confirmationToken ?? randomBytes(24).toString('hex'),
            paidAt: new Date(),
            stripeSessionId: session.id,
            email: session.customer_details?.email ?? session.customer_email ?? order.email,
            amountPaid: (session.amount_total ?? 0) / 100,
            taxCollected: (session.total_details?.amount_tax ?? 0) / 100,
            shippingCharged: (session.total_details?.amount_shipping ?? 0) / 100,
            ...(session.collected_information?.shipping_details
              ? {
                  shippingAddress: session.collected_information
                    .shipping_details as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        })
        if (updated.count) {
          for (const item of order.items) {
            if (!item.productId) continue
            // SQL clamps stale external stock to zero instead of allowing negative inventory.
            await tx.$executeRaw`UPDATE "Product" SET "websiteSold" = "websiteSold" + ${item.quantity}, "quantity" = CASE WHEN "quantity" IS NULL THEN NULL ELSE GREATEST(0, "quantity" - ${item.quantity}) END, "inStock" = CASE WHEN "quantity" IS NULL THEN "inStock" ELSE "quantity" > ${item.quantity} END WHERE "id" = ${item.productId}`
            if (item.inventoryKey?.startsWith('etsy:')) {
              const etsyId = item.inventoryKey.slice(5)
              await tx.$executeRaw`UPDATE "ProductVariation" SET "websiteSold" = "websiteSold" + ${item.quantity}, "quantity" = GREATEST(0, "quantity" - ${item.quantity}) WHERE "productId" = ${item.productId} AND "etsyProductId" = ${etsyId}`
            } else if (item.inventoryKey?.startsWith('local:')) {
              const id = item.inventoryKey.slice(6)
              await tx.$executeRaw`UPDATE "ProductVariation" SET "websiteSold" = "websiteSold" + ${item.quantity}, "quantity" = GREATEST(0, "quantity" - ${item.quantity}) WHERE "id" = ${id} AND "productId" = ${item.productId}`
            }
          }
          changed = order.id
        }
      } else if (!paid && (session.status === 'expired' || failed)) {
        await tx.shopOrder.updateMany({
          where: { id: order.id, paidAt: null, status: 'pending' },
          data: { status: failed ? 'payment_failed' : 'expired', expiresAt: new Date() },
        })
      }
    } else if (orderId) {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } })
      if (order.stripeSessionId === session.id) {
        if (paid && order.paymentStatus !== 'paid') {
          if (session.customer && typeof session.customer === 'string')
            await tx.user.updateMany({
              where: { id: order.userId, stripeCustomerId: null },
              data: { stripeCustomerId: session.customer },
            })
          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'paid',
              paymentMethod: 'card',
              paidAt: new Date(),
              ...(order.status === 'pending' ? { status: 'in_progress' } : {}),
              taxCollected: (session.total_details?.amount_tax ?? 0) / 100,
            },
          })
          await tx.orderEvent.create({
            data: { orderId, type: 'payment_received', description: 'Payment received' },
          })
        } else if (!paid && (session.status === 'expired' || failed) && order.paymentStatus !== 'paid') {
          await tx.order.update({ where: { id: orderId }, data: { stripeSessionId: null } })
        }
      }
    }
    if (eventId) await tx.stripeEvent.create({ data: { id: eventId } })
    return changed
  })
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
export async function notifyShopPurchase(id: string) {
  const order = await prisma.shopOrder.findUniqueOrThrow({ where: { id }, include: { items: true } })
  const appUrl = (process.env.NEXTAUTH_URL || 'https://www.drivenbyfaith3d.com').trim()
  const receipt = `${appUrl}/purchases/${order.confirmationToken}`
  const details = order.items
    .map(
      (i) =>
        `<li>${i.quantity} × ${escape(i.name)}${i.variation ? ` — ${escape(i.variation)}` : ''}${i.personalization ? `<br>Personalization: ${escape(i.personalization)}` : ''}</li>`,
    )
    .join('')
  const html = `<h1>Order ${escape(order.orderNumber ?? order.id)}</h1><p>Your payment is confirmed. Your order is ready for us to prepare.</p><ul>${details}</ul><p>Amount paid: $${(order.amountPaid ?? order.total).toFixed(2)}</p><p><a href="${receipt}">View your receipt and track your order</a></p>`
  const sends = (await adminNotifyEmails()).map((to) =>
    sendEmail({
      to,
      subject: `New purchase: ${order.orderNumber}`,
      htmlContent: `${html}<p><a href="${appUrl}/admin/shop-orders/${id}">Fulfill this order</a></p>`,
    }),
  )
  if (order.email)
    sends.push(
      sendEmail({ to: order.email, subject: `Order confirmed: ${order.orderNumber}`, htmlContent: html }),
    )
  const results = await Promise.allSettled(sends)
  if (results.some((r) => r.status === 'rejected'))
    throw new Error('One or more receipt emails could not be sent')
}
