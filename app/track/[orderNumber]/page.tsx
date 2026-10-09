import { prisma } from '@/lib/prisma'
import { STATUS_STYLES, STATUS_LABELS } from '@/lib/constants'
import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

const LIFECYCLE = [
  { status: 'pending',          label: 'Received' },
  { status: 'in_progress',      label: 'Printing' },
  { status: 'label_created',    label: 'Label Made' },
  { status: 'in_transit',       label: 'In Transit' },
  { status: 'out_for_delivery', label: 'Out for Delivery' },
  { status: 'delivered',        label: 'Delivered' },
]

const LIFECYCLE_ORDER = LIFECYCLE.map(s => s.status)

export default async function PublicTrackingPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params

  const order = await prisma.order.findFirst({
    where: { orderNumber: orderNumber.toUpperCase() },
    select: {
      orderNumber: true,
      status: true,
      orderType: true,
      createdAt: true,
      carrier: true,
      trackingNumber: true,
      trackingUrl: true,
      trackingStatus: true,
    },
  })

  if (!order) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="card p-8 w-full max-w-md text-center">
          <p className="text-warm-gray mb-4">Order not found.</p>
          <p className="text-xs text-zinc-600">Check the order number and try again.</p>
          <Link href="/" className="btn-secondary mt-6 inline-block">Go Home</Link>
        </div>
      </div>
    )
  }

  const currentIdx = LIFECYCLE_ORDER.indexOf(
    ['completed'].includes(order.status) ? 'delivered' : order.status
  )
  const isCancelled = order.status === 'cancelled'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <Link href="/" className="inline-block mb-6">
          <Image src="/logo.png" alt="DrivenByFaith3D" width={56} height={56} className="mx-auto object-contain" />
        </Link>
        <p className="text-xs font-semibold tracking-widest text-warm-gray uppercase mb-1">Order Tracking</p>
        <h1 className="text-3xl font-bold text-charcoal">{order.orderNumber}</h1>
        <p className="text-warm-gray text-sm mt-2">
          Placed {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Status badge */}
      <div className="flex justify-center mb-8">
        <span className={`text-sm font-medium px-4 py-1.5 rounded-full capitalize ${
          isCancelled ? 'bg-red-900/60 text-red-300' : (STATUS_STYLES[order.status] ?? 'bg-zinc-800 text-zinc-300')
        }`}>
          {isCancelled ? 'Cancelled' : (STATUS_LABELS[order.status] ?? order.status.replace(/_/g, ' '))}
        </span>
      </div>

      {/* Progress steps */}
      {!isCancelled && (
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between relative">
            {/* Connector line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-zinc-800 mx-[calc(100%/12)]" />
            {LIFECYCLE.map((step, i) => {
              const done = currentIdx >= i
              const active = currentIdx === i
              return (
                <div key={step.status} className="flex flex-col items-center flex-1 relative z-10">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 transition-colors ${
                    done
                      ? 'bg-white border-white'
                      : 'bg-white border-zinc-700'
                  }`}>
                    {done ? (
                      <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    )}
                  </div>
                  <span className={`text-[10px] text-center leading-tight font-medium ${
                    active ? 'text-charcoal' : done ? 'text-warm-gray' : 'text-zinc-600'
                  }`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tracking info */}
      {order.trackingNumber && (
        <div className="card p-5 mb-6">
          <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Shipping Info</h2>
          <div className="space-y-2 text-sm">
            {order.carrier && (
              <div className="flex gap-3">
                <span className="text-warm-gray w-28">Carrier</span>
                <span className="text-zinc-200 capitalize">{order.carrier}</span>
              </div>
            )}
            <div className="flex gap-3">
              <span className="text-warm-gray w-28">Tracking #</span>
              <span className="text-zinc-200 font-mono">{order.trackingNumber}</span>
            </div>
            {order.trackingUrl && (
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-2 text-sm text-charcoal font-medium hover:underline">
                Track on carrier site →
              </a>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-zinc-600">
        For order details and messages,{' '}
        <Link href="/login" className="text-warm-gray hover:text-charcoal underline transition-colors">sign in to your account</Link>.
      </p>
    </div>
  )
}
