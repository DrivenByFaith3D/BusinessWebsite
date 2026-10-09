export type InboxAction =
  | 'Needs quote'
  | 'Awaiting payment'
  | 'Ready to print'
  | 'Ready to ship'
  | 'Shipped'
  | 'Completed'
  | 'Payment issue'
  | 'Cancelled'
export function customAction(order: {
  status: string
  quote: number | null
  paymentStatus: string | null
}): InboxAction {
  if (order.status === 'cancelled') return 'Cancelled'
  if (['delivered', 'completed'].includes(order.status)) return 'Completed'
  if (['label_created', 'in_transit', 'out_for_delivery'].includes(order.status)) return 'Shipped'
  if (order.quote == null) return 'Needs quote'
  if (order.paymentStatus !== 'paid') return 'Awaiting payment'
  return order.status === 'in_progress' ? 'Ready to ship' : 'Ready to print'
}
export function shopAction(status: string): InboxAction {
  if (status === 'payment_failed') return 'Payment issue'
  if (status === 'expired') return 'Cancelled'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'delivered') return 'Completed'
  if (status === 'shipped') return 'Shipped'
  if (status === 'printing') return 'Ready to ship'
  return status === 'paid' ? 'Ready to print' : 'Awaiting payment'
}
export function etsyAction(order: {
  isPaid: boolean
  isShipped: boolean
  status: string | null
}): InboxAction {
  if (order.status?.toLowerCase().includes('cancel')) return 'Cancelled'
  if (order.isShipped) return 'Shipped'
  return order.isPaid ? 'Ready to ship' : 'Awaiting payment'
}
