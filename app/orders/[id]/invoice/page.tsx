import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatOrderId } from '@/lib/constants'
import { taxEnabled, isNJ, njTax } from '@/lib/tax'
import PrintButton from './PrintButton'
import AdminInvoiceEditor from './AdminInvoiceEditor'

export const dynamic = 'force-dynamic'

const SHOP = { name: 'DrivenByFaith3D', street: '82 Fieldstone Dr', cityLine: 'Springfield, NJ 07081', email: 'info@drivenbyfaith3d.com' }
const money = (n: number) => `$${n.toFixed(2)}`
const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const isAdmin = session.user.role === 'admin'

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!order) notFound()
  if (!isAdmin && order.userId !== session.user.id) notFound()

  const custAddr = await prisma.address.findFirst({
    where: { userId: order.userId },
    orderBy: { isDefault: 'desc' },
    select: { street: true, city: true, state: true, zip: true },
  })
  const customerInNJ = isNJ(custAddr?.state)

  const quote = order.quote ?? 0
  const itemLabel = order.invoiceItemLabel || order.description

  // Tax: exempt → none; paid → the exact amount collected; otherwise the expected amount.
  let taxLabel: string
  let taxAmount: number
  if (order.taxExempt) {
    taxLabel = 'Tax (exempt)'
    taxAmount = 0
  } else if (order.taxCollected != null) {
    taxLabel = 'Sales tax'
    taxAmount = order.taxCollected
  } else {
    taxAmount = taxEnabled() && customerInNJ ? njTax(quote) : 0
    taxLabel = taxAmount > 0 ? 'Sales tax (NJ 6.625%)' : 'Sales tax'
  }
  const total = quote + taxAmount
  const paid = order.paymentStatus === 'paid'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Toolbar (not printed) */}
      <div className="no-print flex items-center justify-between gap-3 mb-6 flex-wrap">
        <Link href={`/orders/${id}`} className="text-sm text-warm-gray hover:text-charcoal">← Back to order</Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <AdminInvoiceEditor
              orderId={order.id}
              itemLabel={order.invoiceItemLabel ?? ''}
              quote={order.quote}
              quantity={order.quantity}
              taxExempt={order.taxExempt}
              notes={order.invoiceNotes ?? ''}
            />
          )}
          <PrintButton />
        </div>
      </div>

      {/* Invoice */}
      <div className="print-area card p-8 sm:p-10">
        {/* Centered logo + business */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={SHOP.name} className="h-16 w-16 object-contain mx-auto mb-2" />
          <p className="font-display text-xl text-charcoal">{SHOP.name}</p>
          <p className="text-xs text-warm-gray">{SHOP.street} · {SHOP.cityLine}</p>
          <p className="text-xs text-warm-gray">{SHOP.email}</p>
        </div>

        {/* Meta */}
        <div className="flex justify-between items-start gap-6 border-t border-taupe/30 pt-5 mb-6 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warm-gray/70 mb-1">Bill to</p>
            <p className="text-sm text-charcoal font-medium">{order.user.name ?? order.user.email}</p>
            <p className="text-xs text-warm-gray">{order.user.email}</p>
            {custAddr && (
              <p className="text-xs text-warm-gray mt-0.5">
                {custAddr.street}<br />{custAddr.city}, {custAddr.state} {custAddr.zip}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-display text-charcoal">INVOICE</p>
            <p className="text-xs text-warm-gray">#{formatOrderId(order)}</p>
            <p className="text-xs text-warm-gray mt-1">Date: {fmtDate(order.createdAt)}</p>
            <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full ${paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {paid ? 'PAID' : 'UNPAID'}
            </span>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-taupe/30 text-warm-gray text-xs uppercase tracking-wide">
              <th className="text-left font-semibold py-2">Description</th>
              <th className="text-center font-semibold py-2 w-16">Qty</th>
              <th className="text-right font-semibold py-2 w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-taupe/15 align-top">
              <td className="py-3 text-charcoal/90 whitespace-pre-wrap pr-4">{itemLabel}</td>
              <td className="py-3 text-center text-charcoal/90">{order.quantity}</td>
              <td className="py-3 text-right text-charcoal/90">{money(quote)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-64 text-sm space-y-1.5">
            <div className="flex justify-between text-warm-gray"><span>Subtotal</span><span className="text-charcoal">{money(quote)}</span></div>
            <div className="flex justify-between text-warm-gray">
              <span>{taxLabel}</span>
              <span className="text-charcoal">{order.taxExempt ? 'Exempt' : money(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-taupe/30">
              <span className="text-charcoal">Total</span><span className="text-charcoal">{money(total)}</span>
            </div>
          </div>
        </div>

        {order.invoiceNotes && (
          <div className="mt-8 border-t border-taupe/30 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warm-gray/70 mb-1">Notes</p>
            <p className="text-sm text-charcoal/85 whitespace-pre-wrap">{order.invoiceNotes}</p>
          </div>
        )}

        <p className="text-center text-xs text-warm-gray/70 mt-8">Thank you for choosing {SHOP.name}.</p>
      </div>
    </div>
  )
}
