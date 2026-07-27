// Sales tax the website collects and must remit to New Jersey itself (unlike
// Etsy, which remits its own). Card orders get the exact tax from Stripe Tax;
// check orders are computed at NJ's flat rate since they're paid locally.
export const NJ_SALES_TAX_RATE = 0.06625

// Master switch: same flag that turns on Stripe automatic tax. Keeps card and
// check behaviour in lockstep so we never charge tax on one but not the other.
export function taxEnabled(): boolean {
  return process.env.STRIPE_TAX_ENABLED === 'true'
}

export function njTax(amount: number): number {
  return Math.round(amount * NJ_SALES_TAX_RATE * 100) / 100
}

// Start of the calendar quarter containing `d` (for the quarterly remittance total).
export function quarterStart(d: Date = new Date()): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}

export function quarterLabel(d: Date = new Date()): string {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
}
