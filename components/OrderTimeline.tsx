import { formatDateTime } from '@/lib/format'

interface OrderEvent {
  id: string
  type: string
  description: string
  createdAt: Date | string
}

const EVENT_STYLES: Record<string, { dot: string; icon: React.ReactNode }> = {
  order_created:    { dot: 'bg-zinc-400',   icon: <circle cx="12" cy="12" r="4" /> },
  status_changed:   { dot: 'bg-blue-400',   icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /> },
  quote_set:        { dot: 'bg-yellow-400', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 13v-1m-2.599-2A2.51 2.51 0 009 16c0 1.105 1.343 2 3 2s3-.895 3-2c0-.768-.47-1.47-1.2-1.857" /> },
  payment_received: { dot: 'bg-green-400',  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> },
  label_created:    { dot: 'bg-purple-400', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
}

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) return null

  return (
    <div className="card p-5 mb-6">
      <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-4">Activity Timeline</h2>
      <div className="space-y-0">
        {events.map((event, i) => {
          const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.status_changed
          const isLast = i === events.length - 1
          const time = formatDateTime(event.createdAt)
          return (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${style.dot}`} />
                {!isLast && <div className="w-px bg-zinc-800 flex-1 mt-1 mb-0" style={{ minHeight: '20px' }} />}
              </div>
              <div className={`${isLast ? '' : 'pb-4'}`}>
                <p className="text-sm text-zinc-200">{event.description}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{time}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
