import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createEtsyAuthedReader, getValidAccessToken } from '@/lib/etsy-oauth'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// The tracker reads through this service instead of copying the shop OAuth grant.
export async function POST(req: NextRequest) {
  const expected = process.env.ETSY_TRACKER_SYNC_SECRET
  const supplied = req.headers.get('x-tracker-sync-secret') ?? ''
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const min = Number(body?.min_created)
  const max = Number(body?.max_created)
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 ||
      max <= min || max - min > 731 * 86400 || max > Math.floor(Date.now() / 1000) + 60) {
    return NextResponse.json({ error: 'Invalid ledger date range' }, { status: 400 })
  }
  try {
    const { shopId } = await getValidAccessToken()
    const rawRead = createEtsyAuthedReader()
    let lastRead = 0
    async function read<T>(path: string): Promise<T> {
      for (let attempt = 0; ; attempt++) {
        await new Promise(resolve => setTimeout(resolve, Math.max(0, lastRead + 1100 - Date.now())))
        lastRead = Date.now()
        try { return await rawRead<T>(path) } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('Etsy 429 ') || attempt >= 4) throw error
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
        }
      }
    }
    async function all(path: string) {
      const rows: Record<string, unknown>[] = []
      for (let offset = 0; ; ) {
        const page = await read<{ count: number; results: Record<string, unknown>[] }>(
          `${path}?limit=100&offset=${offset}&includes=Transactions`,
        )
        if (!Array.isArray(page.results) || !Number.isInteger(page.count)) throw new Error('Invalid Etsy response')
        rows.push(...page.results)
        offset += page.results.length
        if (offset >= page.count) return rows
        if (!page.results.length || offset > 10000) throw new Error('Etsy pagination incomplete')
      }
    }
    const receipts = await all(`/shops/${shopId}/receipts`)
    const payments: Record<string, unknown>[] = []
    for (const receipt of receipts) {
      if (!receipt.is_paid) continue
      const page = await read<{ count: number; results: Record<string, unknown>[] }>(
        `/shops/${shopId}/receipts/${receipt.receipt_id}/payments`,
      )
      if (!Array.isArray(page.results)) throw new Error('Invalid Etsy payment response')
      payments.push(...page.results)
    }
    const entries = new Map<string, Record<string, unknown>>()
    for (let start = min; start < max; start += 30 * 86400) {
      const end = Math.min(start + 30 * 86400, max) - 1
      let offset = 0
      for (;;) {
        const page = await read<{ count: number; results: Record<string, unknown>[] }>(
          `/shops/${shopId}/payment-account/ledger-entries?limit=100&offset=${offset}&min_created=${start}&max_created=${end}`,
        )
        if (!Array.isArray(page.results) || !Number.isInteger(page.count)) throw new Error('Invalid Etsy ledger response')
        for (const entry of page.results) {
          if (!Number.isSafeInteger(entry.entry_id)) throw new Error('Ledger entry has no stable ID')
          entries.set(String(entry.entry_id), entry)
        }
        offset += page.results.length
        if (offset >= page.count) break
        if (!page.results.length || offset > 10000) throw new Error('Etsy ledger pagination incomplete')
      }
    }
    const pick = (row: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map(key => [key, row[key]]))
    return NextResponse.json({ shop_id: shopId, min_created: min, max_created: max, entries: [...entries.values()],
      receipts: receipts.map(row => ({ ...pick(row, ['receipt_id', 'grandtotal', 'subtotal', 'total_shipping_cost', 'total_tax_cost', 'total_vat_cost', 'is_paid', 'is_shipped', 'status', 'created_timestamp', 'create_timestamp', 'refunds']),
        titles: Array.isArray(row.transactions) ? row.transactions.map((t: Record<string, unknown>) => t.title).filter(Boolean) : [],
        transactions: Array.isArray(row.transactions) ? row.transactions.map((t:Record<string,unknown>) => pick(t,['transaction_id','listing_id','quantity'])) : [],
        shipments: Array.isArray(row.shipments) ? row.shipments.map((s:Record<string,unknown>) => pick(s,['receipt_shipping_id','shipping_label_cost','shipping_label_currency','shipped_timestamp'])) : [],
      })),
      payments: payments.map(row => pick(row, ['payment_id', 'receipt_id', 'amount_gross', 'amount_fees', 'posted_fees', 'adjusted_fees', 'currency', 'created_timestamp', 'create_timestamp', 'updated_timestamp', 'payment_adjustments'])),
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    const status = error instanceof Error ? error.message.match(/^Etsy (\d{3}) on ([^:]+):/) : null
    console.error('Tracker Etsy ledger read failed:', status ? { status: status[1], path: status[2] } : error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: 'Unable to read Etsy ledger. Check the seller connection in website admin.' }, { status: 502 })
  }
}
