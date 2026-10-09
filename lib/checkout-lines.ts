export interface CheckoutLine {
  productId: string
  variationId: string | null
  personalization: string | null
  quantity: number
  cartKey: string
}
export function cartLineKey(productId: string, variationId?: string | null, personalization?: string | null) {
  const base = `${productId}::${variationId ?? ''}`
  return personalization?.trim() ? `${base}::${encodeURIComponent(personalization.trim())}` : base
}
export function parseCheckoutLines(raw: unknown): CheckoutLine[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 100)
    throw new Error('Your cart is empty or too large.')
  const lines = new Map<string, CheckoutLine>()
  for (const value of raw) {
    if (
      !value ||
      typeof value.productId !== 'string' ||
      !value.productId ||
      value.productId.length > 200 ||
      !Number.isInteger(value.quantity) ||
      value.quantity < 1 ||
      value.quantity > 99 ||
      (value.variationId != null && typeof value.variationId !== 'string') ||
      (value.personalization != null && typeof value.personalization !== 'string')
    )
      throw new Error('Please check your cart quantities and options.')
    const personalization = value.personalization?.trim() || null
    if (personalization && personalization.length > 500)
      throw new Error('Personalization must be 500 characters or fewer.')
    const variationId = value.variationId || null
    const cartKey = cartLineKey(value.productId, variationId, personalization)
    const quantity = (lines.get(cartKey)?.quantity ?? 0) + value.quantity
    if (quantity > 99) throw new Error('A cart line can contain up to 99 items.')
    lines.set(cartKey, { productId: value.productId, variationId, personalization, quantity, cartKey })
  }
  return [...lines.values()].sort((a, b) => a.cartKey.localeCompare(b.cartKey))
}
export function remainingCart<T extends { key: string; quantity: number }>(
  cart: T[],
  purchased: { cartKey: string | null; quantity: number }[],
) {
  const quantities = new Map<string, number>()
  for (const item of purchased)
    if (item.cartKey) quantities.set(item.cartKey, (quantities.get(item.cartKey) ?? 0) + item.quantity)
  return cart
    .map((item) => ({ ...item, quantity: Math.max(0, item.quantity - (quantities.get(item.key) ?? 0)) }))
    .filter((item) => item.quantity > 0)
}
export function assertAvailable(name: string, requested: number, stock: number | null, reserved: number) {
  if (stock != null && requested > Math.max(0, stock - reserved))
    throw new Error(
      `Only ${Math.max(0, stock - reserved)} of ${name} are available. Please update your cart.`,
    )
}
