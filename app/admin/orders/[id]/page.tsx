import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STATUS_STYLES, STATUS_LABELS, formatOrderId } from '@/lib/constants'
import ChatWindow from '@/components/ChatWindow'
import AdminNotes from '@/components/AdminNotes'
import CustomerNotes from '@/components/CustomerNotes'
import OrderTimeline from '@/components/OrderTimeline'
import FilePreview from '@/components/FilePreview'
import AdminOrderPhotos from '@/components/AdminOrderPhotos'
import ShippingStatus from '@/components/ShippingStatus'
import AdminOrderActions from './AdminOrderActions'

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      files: true,
      quoteHistory: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
      photos: { orderBy: { createdAt: 'asc' } },
      user: {
        select: {
          id: true, email: true, name: true,
          addresses: { orderBy: { isDefault: 'desc' }, take: 1 },
        },
      },
    },
  })

  if (!order) notFound()

  const messages = await prisma.message.findMany({
    where: { orderId: id },
    include: { sender: { select: { email: true, role: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  try {
    await prisma.orderView.upsert({
      where: { userId_orderId: { userId: session.user.id, orderId: id } },
      create: { userId: session.user.id, orderId: id },
      update: { viewedAt: new Date() },
    })
  } catch { /* ignore if user record not found */ }

  const defaultAddr = order.user.addresses[0] ?? null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/orders" className="text-warm-gray hover:text-charcoal transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-charcoal">{formatOrderId(order)}</h1>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_STYLES[order.status] ?? 'bg-taupe/20 text-warm-gray'}`}>
              {STATUS_LABELS[order.status] ?? order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-warm-gray flex-wrap">
            <span>{order.user.name ?? order.user.email}</span>
            <span>·</span>
            <span>{order.user.email}</span>
            <span>·</span>
            <span>{new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-0">

          {/* Description */}
          <div className="card p-5 mb-6">
            <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-2">Description</h2>
            <p className="text-sm text-charcoal/85 whitespace-pre-wrap leading-relaxed">{order.description}</p>
            {order.orderType && (
              <p className="text-xs text-warm-gray/60 mt-2">
                Type: {order.orderType === 'stl' ? 'STL File' : order.orderType === 'image' ? 'Image Reference' : order.orderType === 'contact' ? 'Contact Inquiry' : 'From Scratch'}
              </p>
            )}
          </div>

          {/* Files */}
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

          {/* Admin-uploaded photos */}
          <AdminOrderPhotos orderId={id} initialPhotos={order.photos} />

          {/* Shipping status */}
          {['label_created', 'in_transit', 'out_for_delivery', 'delivered'].includes(order.status) && order.trackingNumber && (
            <div className="mb-6">
              <ShippingStatus order={order} />
            </div>
          )}

          {/* Timeline */}
          <OrderTimeline events={order.events} />

          {/* Chat */}
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
            isAdmin={true}
          />
        </div>

        {/* Right: actions panel */}
        <div className="space-y-0">
          <AdminOrderActions
            orderId={id}
            currentStatus={order.status}
            customerName={order.user.name ?? order.user.email}
            defaultAddress={defaultAddr}
            quote={order.quote ?? null}
            paymentStatus={order.paymentStatus ?? null}
            labelUrl={order.labelUrl ?? null}
          />

          <AdminNotes orderId={id} initialNotes={order.adminNotes ?? null} />
          <CustomerNotes orderId={id} initialNotes={order.customerNotes ?? null} />

          {/* Quote history */}
          {order.quoteHistory.length > 0 && (
            <div className="card p-5">
              <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Quote History</h2>
              <div className="space-y-2">
                {order.quoteHistory.map((q, i) => (
                  <div key={q.id} className="flex items-center justify-between text-sm">
                    <span className={`font-semibold ${i === order.quoteHistory.length - 1 ? 'text-charcoal' : 'text-warm-gray line-through'}`}>
                      ${q.amount.toFixed(2)}
                      {i === order.quoteHistory.length - 1 && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-taupe/20 text-warm-gray font-normal">current</span>
                      )}
                    </span>
                    <span className="text-warm-gray/60 text-xs">
                      {new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
