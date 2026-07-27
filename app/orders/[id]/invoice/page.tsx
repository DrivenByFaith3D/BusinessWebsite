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

// Self-contained invoice styling so the printed sheet looks identical to the
// screen and doesn't depend on the app theme (which browsers strip when printing).
const CSS = `
.inv-wrap{max-width:820px;margin:0 auto}
.inv-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.inv-back{font-size:14px;color:#7D756D;text-decoration:none}
.inv-back:hover{color:#2C2C2C}
.inv-sheet{background:#fff;padding:56px 60px 48px;border-radius:2px;box-shadow:0 4px 24px rgba(0,0,0,.08);color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.inv-foot{padding-top:4px}
.inv-head{text-align:center;padding-bottom:26px;border-bottom:2px solid #2C2C2C}
.inv-head img{height:64px;width:64px;object-fit:contain;margin:0 auto 10px;display:block}
.inv-brand{font-size:24px;font-weight:700;letter-spacing:.5px}
.inv-brand-sub{font-size:12px;color:#7D756D;margin-top:4px;line-height:1.55}
.inv-meta{display:flex;justify-content:space-between;gap:24px;margin-top:30px;flex-wrap:wrap}
.inv-label{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#7D756D;margin-bottom:6px}
.inv-billto p{font-size:13px;line-height:1.6;margin:0}
.inv-billto .nm{font-weight:600;font-size:14px}
.inv-right{text-align:right}
.inv-title{font-size:26px;font-weight:700;letter-spacing:.06em}
.inv-row{font-size:12px;color:#7D756D;margin-top:3px}
.inv-row b{color:#2C2C2C;font-weight:600}
.inv-badge{display:inline-block;margin-top:10px;font-size:11px;font-weight:700;letter-spacing:.05em;padding:4px 12px;border-radius:999px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inv-badge.paid{background:#E4F0E4;color:#2F6B34}
.inv-badge.unpaid{background:#F6EAD2;color:#8A5A00}
.inv-table{width:100%;border-collapse:collapse;margin-top:34px}
.inv-table thead th{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#7D756D;text-align:left;padding:0 0 10px;border-bottom:1.5px solid #D6D0C8}
.inv-table thead th.c{text-align:center}.inv-table thead th.r{text-align:right}
.inv-table th.c,.inv-table td.c{width:70px}
.inv-table th.r,.inv-table td.r{width:130px;padding-left:18px}
.inv-table tbody td{font-size:13.5px;padding:16px 0;border-bottom:1px solid #E7E2DA;vertical-align:top;line-height:1.5}
.inv-table tbody td.c{text-align:center}.inv-table tbody td.r{text-align:right;white-space:nowrap}
.inv-table td.desc{padding-right:20px;white-space:pre-wrap}
.inv-totals{display:flex;justify-content:flex-end;margin-top:22px}
.inv-totals .box{width:280px}
.inv-trow{display:flex;justify-content:space-between;font-size:13.5px;padding:7px 0;color:#7D756D}
.inv-trow span:last-child{color:#2C2C2C}
.inv-trow.grand{border-top:2px solid #2C2C2C;margin-top:6px;padding-top:12px;font-size:17px;font-weight:700}
.inv-trow.grand span{color:#2C2C2C}
.inv-notes{margin-top:40px;padding-top:20px;border-top:1px solid #E7E2DA}
.inv-notes p{font-size:13px;line-height:1.6;color:#2C2C2C;margin:0}
.inv-thanks{text-align:center;font-size:12px;color:#7D756D;margin-top:40px;letter-spacing:.02em}
@media print{
  @page{size:letter;margin:.5in}
  /* Collapse the app's full-height flex layout so it doesn't paginate. */
  html,body{height:auto!important;min-height:0!important;margin:0!important;padding:0!important;background:#fff!important}
  body{display:block!important}
  main{flex:none!important;display:block!important;min-height:0!important}
  nav,footer,.no-print,.inv-toolbar{display:none!important}
  .inv-page{padding:0!important;margin:0!important}
  .inv-wrap{max-width:none;margin:0}
  .inv-sheet{box-shadow:none;border-radius:0;padding:0}
}
`

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
  // Strip internal tags from the raw request for a clean customer-facing line item:
  // the leading "[Design & Print, $12/print hr]" and any "(/listings/…)" links.
  const cleanDescription = (d: string) =>
    d.replace(/^\s*\[[^\]]*\]\s*/, '').replace(/\s*\(\/listings\/[^)]*\)/g, '').trim()
  const itemLabel = order.invoiceItemLabel || cleanDescription(order.description)

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
    <div className="inv-page px-4 sm:px-6 lg:px-8 py-10">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="inv-wrap">
        <div className="inv-toolbar">
          <Link href={`/orders/${id}`} className="inv-back">← Back to order</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

        <div className="inv-sheet">
          <div className="inv-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={SHOP.name} />
            <div className="inv-brand">{SHOP.name}</div>
            <div className="inv-brand-sub">{SHOP.email}</div>
          </div>

          <div className="inv-meta">
            <div className="inv-billto">
              <div className="inv-label">Bill To</div>
              <p className="nm">{order.user.name ?? order.user.email}</p>
              <p>{order.user.email}</p>
              {custAddr && <p>{custAddr.street}<br />{custAddr.city}, {custAddr.state} {custAddr.zip}</p>}
            </div>
            <div className="inv-right">
              <div className="inv-title">INVOICE</div>
              <div className="inv-row">#{formatOrderId(order)}</div>
              <div className="inv-row">Date: <b>{fmtDate(order.createdAt)}</b></div>
              <span className={`inv-badge ${paid ? 'paid' : 'unpaid'}`}>{paid ? 'PAID' : 'UNPAID'}</span>
            </div>
          </div>

          <table className="inv-table">
            <thead>
              <tr><th>Description</th><th className="c">Qty</th><th className="r">Amount</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="desc">{itemLabel}</td>
                <td className="c">{order.quantity}</td>
                <td className="r">{money(quote)}</td>
              </tr>
            </tbody>
          </table>

          <div className="inv-foot">
            <div className="inv-totals">
              <div className="box">
                <div className="inv-trow"><span>Subtotal</span><span>{money(quote)}</span></div>
                <div className="inv-trow"><span>{taxLabel}</span><span>{order.taxExempt ? 'Exempt' : money(taxAmount)}</span></div>
                <div className="inv-trow grand"><span>Total</span><span>{money(total)}</span></div>
              </div>
            </div>

            {order.invoiceNotes && (
              <div className="inv-notes">
                <div className="inv-label">Notes</div>
                <p>{order.invoiceNotes}</p>
              </div>
            )}

            <div className="inv-thanks">Thank you for choosing {SHOP.name}.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
