import { etsyAuthedGet, getValidAccessToken } from './etsy-oauth'

// Exact per-order Etsy fees, read from the shop's payment-account ledger.
// Etsy posts each fee (transaction, offsite ads, listing, etc.) as its own
// ledger entry tagged with a reference_type/reference_id we can tie to an order.
// This is the authoritative source — the /payments amount_fees field only covers
// the payment-processing slice, and amount_net omits the transaction/ads fees.

export interface LedgerEntry {
  amount: number // minor units, e.g. cents for USD (negative = money out)
  currency: string
  description: string | null
  reference_type: string | null
  reference_id: number | null
}

// Etsy caps a single ledger query at a 31-day window, so we walk the range in
// 30-day chunks and paginate within each.
const CHUNK_SECONDS = 30 * 86400

async function fetchLedgerChunk(shopId: string, min: number, max: number): Promise<LedgerEntry[]> {
  const out: LedgerEntry[] = []
  const limit = 100
  let offset = 0
  for (;;) {
    const page = await etsyAuthedGet<{ count: number; results: LedgerEntry[] }>(
      `/shops/${shopId}/payment-account/ledger-entries?limit=${limit}&offset=${offset}&min_created=${min}&max_created=${max}`,
    )
    const results = page.results ?? []
    out.push(...results)
    offset += results.length
    if (results.length < limit || offset >= (page.count ?? 0)) break
    if (offset > 10000) break
  }
  return out
}

// Pull every ledger entry created within a window, chunking to satisfy the 31-day cap.
export async function fetchLedgerEntries(minCreated: number, maxCreated: number): Promise<LedgerEntry[]> {
  const { shopId } = await getValidAccessToken()
  const all: LedgerEntry[] = []
  for (let start = minCreated; start < maxCreated; start += CHUNK_SECONDS) {
    const end = Math.min(start + CHUNK_SECONDS, maxCreated)
    all.push(...(await fetchLedgerChunk(shopId, start, end)))
  }
  return all
}

export interface OrderFeeInput {
  receiptId: string
  grandTotal: number | null
  transactionIds: string[]
}

export interface OrderFees {
  etsyFees: number // total Etsy fees for the order (positive dollars)
  salesTax: number // sales tax Etsy collected & remits (pass-through, positive dollars)
}

// US Etsy Payments processing fee: 3% + $0.25 of the order total (incl. tax).
// The ledger tags this to the payment id (not the receipt), so we derive it by
// Etsy's published US rate rather than an extra per-order payment lookup.
function processingFee(grandTotal: number): number {
  return Math.round((grandTotal * 0.03 + 0.25) * 100) / 100
}

const r2 = (n: number) => Math.round(n * 100) / 100

// Sum the ledger fees that belong to one order.
export function computeOrderFees(order: OrderFeeInput, entries: LedgerEntry[]): OrderFees {
  const txnIds = new Set(order.transactionIds.map(String))
  let receiptFees = 0 // offsite ads and any other receipt-level fees
  let txnFees = 0 // transaction fee + per-quantity transaction fee
  let salesTax = 0

  for (const e of entries) {
    const amt = (e.amount ?? 0) / 100
    const desc = (e.description ?? '').toLowerCase()
    const refId = String(e.reference_id ?? '')

    if (e.reference_type === 'receipt' && refId === String(order.receiptId)) {
      if (desc === 'sales_tax') salesTax += Math.abs(amt)
      else if (amt < 0) receiptFees += Math.abs(amt)
    } else if (e.reference_type === 'transaction' && txnIds.has(refId)) {
      if (amt < 0) txnFees += Math.abs(amt)
    }
  }

  const processing = order.grandTotal ? processingFee(order.grandTotal) : 0
  return { etsyFees: r2(processing + txnFees + receiptFees), salesTax: r2(salesTax) }
}
