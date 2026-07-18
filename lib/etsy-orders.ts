import { etsyAuthedGet, getValidAccessToken } from './etsy-oauth'
import { money, type EtsyMoney } from './etsy'

// Reads and parses Etsy receipts (orders). Requires an OAuth connection.

export interface EtsyTransaction {
  transaction_id: number
  title?: string
  quantity?: number
  listing_id?: number | null
  product_id?: number | null
  price?: EtsyMoney
  variations?: { formatted_name?: string; formatted_value?: string; property_name?: string; value?: string }[]
}

export interface EtsyShipment {
  carrier_name?: string | null
  tracking_code?: string | null
  tracking_url?: string | null
}

export interface EtsyReceipt {
  receipt_id: number
  name?: string | null
  status?: string | null
  is_paid?: boolean
  is_shipped?: boolean
  first_line?: string | null
  second_line?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country_iso?: string | null
  formatted_address?: string | null
  message_from_buyer?: string | null
  grandtotal?: EtsyMoney
  create_timestamp?: number
  created_timestamp?: number
  transactions?: EtsyTransaction[]
  shipments?: EtsyShipment[]
}

export async function fetchReceipts(): Promise<EtsyReceipt[]> {
  const { shopId } = await getValidAccessToken()
  const all: EtsyReceipt[] = []
  const limit = 100
  let offset = 0

  for (;;) {
    const page = await etsyAuthedGet<{ count: number; results: EtsyReceipt[] }>(
      `/shops/${shopId}/receipts?limit=${limit}&offset=${offset}&includes=Transactions`,
    )
    const results = page.results ?? []
    all.push(...results)
    offset += results.length
    if (results.length < limit || offset >= (page.count ?? 0)) break
    if (offset > 5000) break
  }

  return all
}

export function variationLabel(txn: EtsyTransaction): string | null {
  const parts = (txn.variations ?? [])
    .map((v) => {
      const name = v.formatted_name ?? v.property_name ?? ''
      const value = v.formatted_value ?? v.value ?? ''
      return name && value ? `${name}: ${value}` : value
    })
    .filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

// Existing tracking on the receipt, from a shipment already added on Etsy.
export function receiptTracking(receipt: EtsyReceipt): { code: string; carrier: string | null } | null {
  const s = (receipt.shipments ?? []).find((x) => x.tracking_code)
  return s?.tracking_code ? { code: s.tracking_code, carrier: s.carrier_name ?? null } : null
}

export function receiptTotal(receipt: EtsyReceipt): number | null {
  return money(receipt.grandtotal)
}
