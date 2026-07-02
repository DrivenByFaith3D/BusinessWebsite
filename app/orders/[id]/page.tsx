import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ChatWindow from '@/components/ChatWindow'
import OrderProgressBar from '@/components/OrderProgressBar'
import ShippingStatus from '@/components/ShippingStatus'
import CheckoutOptions from '@/components/CheckoutOptions'
import AdminNotes from '@/components/AdminNotes'
import CustomerNotes from '@/components/CustomerNotes'
import OrderDescription from '@/components/OrderDescription'
import FilePreview from '@/components/FilePreview'
import OrderTimeline from '@/components/OrderTimeline'
import OrderPhotos from '@/components/OrderPhotos'
import { STATUS_STYLES, STATUS_LABELS, formatOrderId } from '@/lib/constants'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'admin'

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      files: true,
      quoteHistory: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
      photos: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!order) notFound()
  if (!isAdmin && order.userId !== session.user.id) notFound()

  const messages = await prisma.message.findMany({
    where: { orderId: id },
    include: { sender: { select: { email: true, role: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Mark messages as read for current user
  await prisma.orderView.upsert({
    where: { userId_orderId: { userId: session.user.id, orderId: id } },
    create: { userId: session.user.id, orderId: id },
    update: { viewedAt: new Date() },
  })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-warm-gray">Order</p>
          <h1 className="text-2xl font-bold text-charcoal">{formatOrderId(order)}</h1>
          <p className="text-sm text-warm-gray mt-1">
            Created {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {!isAdmin && order.status === 'delivered' && (
            <Link
              href={`/orders/new?type=${order.orderType ?? 'scratch'}&description=${encodeURIComponent(order.description.slice(0, 500))}`}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border border-taupe/30 text-warm-gray hover:border-taupe/30 hover:text-charcoal transition-colors"
            >
              Reorder
            </Link>
          )}
          {isAdmin && order.labelUrl && (
            <a href={order.labelUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Label
            </a>
          )}
          <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${STATUS_STYLES[order.status] || 'bg-zinc-800 text-warm-gray'}`}>
            {STATUS_LABELS[order.status] ?? order.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {!isAdmin && <OrderProgressBar status={order.status} />}

      <OrderDescription
        orderId={id}
        initialDescription={order.description}
        canEdit={!isAdmin && order.status === 'pending'}
      />

      {isAdmin && <AdminNotes orderId={id} initialNotes={order.adminNotes ?? null} />}
      {isAdmin && <CustomerNotes orderId={id} initialNotes={order.customerNotes ?? null} />}
      {!isAdmin && order.customerNotes && (
        <div className="card p-5 mb-6 border border-blue-800/40 bg-blue-950/10">
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Note from Team</h2>
          <p className="text-sm text-warm-gray whitespace-pre-wrap">{order.customerNotes}</p>
        </div>
      )}

      {isAdmin && order.quoteHistory.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Quote History</h2>
          <div className="space-y-2">
            {order.quoteHistory.map((q, i) => (
              <div key={q.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${i === order.quoteHistory.length - 1 ? 'text-charcoal' : 'text-warm-gray line-through'}`}>
                    ${q.amount.toFixed(2)}
                  </span>
                  {i === order.quoteHistory.length - 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-warm-gray">current</span>
                  )}
                </div>
                <span className="text-zinc-600 text-xs">
                  {new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAdmin && order.quote && order.paymentStatus !== 'paid' && (
        <CheckoutOptions
          orderId={order.id}
          quote={order.quote}
          paymentMethod={order.paymentMethod}
        />
      )}

      {!isAdmin && order.paymentStatus === 'paid' && order.quote && (
        <div className="card p-5 mb-6 border border-green-800/50 bg-green-950/20">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-300">Payment of <span className="font-semibold">${order.quote.toFixed(2)}</span> received, your order is in progress.</p>
          </div>
        </div>
      )}

      {['label_created', 'in_transit', 'out_for_delivery', 'delivered'].includes(order.status) && order.trackingNumber && (
        <div className="mb-6">
          <ShippingStatus order={order} />
        </div>
      )}

      {order.files.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Uploaded Files</h2>
          <div className="space-y-4">
            {order.files.map((file) => (
              <FilePreview key={file.id} url={file.url} name={file.name ?? ''} />
            ))}
          </div>
        </div>
      )}

      {!isAdmin && <OrderPhotos photos={order.photos} />}

      <OrderTimeline events={order.events} />

      <ChatWindow
        orderId={id}
        initialMessages={messages.map(m => ({
          id: m.id,
          orderId: m.orderId,
          senderId: m.senderId,
          content: m.content,
          fileUrl: m.fileUrl,
          createdAt: m.createdAt.toISOString(),
          senderEmail: m.sender.email,
          senderName: m.sender.name,
          senderRole: m.sender.role,
        }))}
        currentUserId={session.user.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
