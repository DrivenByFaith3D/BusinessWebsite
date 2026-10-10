export const ETSY_SCOPES = 'transactions_r transactions_w listings_r shops_r'
export function missingEtsyScopes(scope: string | null | undefined) {
  const granted = new Set(scope?.split(/\s+/).filter(Boolean))
  return ETSY_SCOPES.split(' ').filter(s => !granted.has(s))
}
