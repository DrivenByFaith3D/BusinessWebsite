'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Slot { id: string; startsAt: string; duration: number }

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function BookClient({ slots: initial, defaultName }: { slots: Slot[]; defaultName: string }) {
  const { status } = useSession()
  const authed = status === 'authenticated'

  const [slots, setSlots] = useState<Slot[]>(initial)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [name, setName] = useState(defaultName)
  const [topic, setTopic] = useState('')
  const [state, setState] = useState<'idle' | 'booking' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState<Slot | null>(null)

  async function book() {
    if (!selected || !authed) return
    setState('booking'); setError('')
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: selected.id, name, topic }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not book that time.')
      setState('error')
      if (res.status === 409 || res.status === 404) {
        setSlots((s) => s.filter((x) => x.id !== selected.id))
        setSelected(null)
      }
      return
    }
    setConfirmed(selected)
    setState('done')
  }

  // Confirmation view
  if (state === 'done' && confirmed) {
    return (
      <div className="card p-8 text-center">
        <div className="flex justify-center mb-4 text-charcoal">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h3 className="font-display text-2xl text-charcoal mb-2">You&apos;re booked!</h3>
        <p className="text-warm-gray text-sm mb-1">
          {dayKey(confirmed.startsAt)} at {timeLabel(confirmed.startsAt)}
        </p>
        <p className="text-warm-gray text-sm mb-6">{confirmed.duration}-minute consultation. We&apos;ll be in touch to confirm details.</p>
        <Link href="/" className="btn-primary">Back to Home</Link>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h3 className="font-display text-xl text-charcoal mb-2">No open times right now</h3>
        <p className="text-warm-gray text-sm mb-6">We&apos;re fully booked at the moment. Check back soon, or send us a message and we&apos;ll find a time.</p>
        <Link href="/contact" className="btn-secondary">Contact Us</Link>
      </div>
    )
  }

  // group slots by day
  const groups: Record<string, Slot[]> = {}
  for (const s of slots) { (groups[dayKey(s.startsAt)] ||= []).push(s) }

  return (
    <div className="space-y-8">
      {/* Slot picker */}
      <div className="space-y-6">
        {Object.entries(groups).map(([day, daySlots]) => (
          <div key={day}>
            <h3 className="font-display text-lg text-charcoal mb-3">{day}</h3>
            <div className="flex flex-wrap gap-2.5">
              {daySlots.map((s) => {
                const isSel = selected?.id === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                      isSel
                        ? 'bg-charcoal text-white border-charcoal'
                        : 'bg-white text-charcoal border-taupe/50 hover:border-charcoal'
                    }`}
                  >
                    {timeLabel(s.startsAt)} <span className={isSel ? 'text-white/70' : 'text-warm-gray'}>· {s.duration}m</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm panel */}
      {selected && (
        <div className="card p-6">
          <p className="text-sm text-warm-gray mb-4">
            Booking <span className="text-charcoal font-semibold">{dayKey(selected.startsAt)} at {timeLabel(selected.startsAt)}</span> ({selected.duration} min)
          </p>

          {authed ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">What would you like to discuss? <span className="text-warm-gray font-normal">(optional)</span></label>
                <textarea className="input-textarea min-h-[90px]" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A quick note about your project." />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={book} className="btn-primary" disabled={state === 'booking'}>
                {state === 'booking' ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 rounded-xl bg-taupe/15 border border-taupe/40 p-4 mb-4">
                <svg className="w-5 h-5 shrink-0 mt-0.5 text-taupe-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25 12 15m0-9h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-sm text-warm-gray leading-relaxed">
                  Please sign in or create a quick account to confirm your booking, so we can send you reminders and stay in touch.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/login?callbackUrl=/book" className="btn-primary text-center">
                  {status === 'loading' ? 'Loading…' : 'Sign in to book'}
                </Link>
                <Link href="/signup?callbackUrl=/book" className="btn-secondary text-center">Create an account</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
