'use client'

import { useState } from 'react'

interface Booking { id: string; name: string; topic: string | null; email: string }
interface Slot { id: string; startsAt: string; duration: number; booking: Booking | null }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function AvailabilityClient({ initialSlots }: { initialSlots: Slot[] }) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!date || !time) { setError('Pick a date and time.'); return }
    const startsAt = new Date(`${date}T${time}`)
    if (isNaN(startsAt.getTime())) { setError('That date/time is invalid.'); return }
    setSaving(true)
    const res = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startsAt: startsAt.toISOString(), duration }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Could not add that slot.'); return }
    setSlots((s) => [...s, { id: data.id, startsAt: data.startsAt, duration: data.duration, booking: null }]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
    setTime('')
  }

  async function remove(slot: Slot) {
    const msg = slot.booking
      ? `This slot is booked by ${slot.booking.name}. Deleting it will cancel their booking. Continue?`
      : 'Delete this open slot?'
    if (!confirm(msg)) return
    await fetch(`/api/availability?id=${slot.id}`, { method: 'DELETE' })
    setSlots((s) => s.filter((x) => x.id !== slot.id))
  }

  // group by day
  const groups: Record<string, Slot[]> = {}
  for (const s of slots) { (groups[fmtDate(s.startsAt)] ||= []).push(s) }

  return (
    <div className="space-y-8">
      {/* Add slot */}
      <form onSubmit={add} className="card p-5">
        <h2 className="font-semibold text-charcoal mb-4">Add an open time</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-warm-gray mb-1">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-gray mb-1">Time</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-gray mb-1">Length</label>
            <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>
          <button type="submit" className="btn-primary text-sm" disabled={saving}>
            {saving ? 'Adding…' : 'Add slot'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </form>

      {/* Slot list */}
      {slots.length === 0 ? (
        <p className="text-warm-gray text-sm text-center py-8">No upcoming slots yet. Add your first open time above.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([day, daySlots]) => (
            <div key={day}>
              <h3 className="font-display text-lg text-charcoal mb-3">{day}</h3>
              <div className="space-y-2">
                {daySlots.map((s) => (
                  <div key={s.id} className="card p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-charcoal">{fmtTime(s.startsAt)} <span className="text-warm-gray font-normal">· {s.duration} min</span></p>
                      {s.booking ? (
                        <p className="text-sm text-warm-gray mt-0.5 truncate">
                          Booked by <span className="text-charcoal font-medium">{s.booking.name}</span> ({s.booking.email})
                          {s.booking.topic ? ` — “${s.booking.topic}”` : ''}
                        </p>
                      ) : (
                        <p className="text-sm text-green-700 mt-0.5">Open</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${s.booking ? 'bg-taupe/30 text-charcoal' : 'bg-green-100 text-green-800'}`}>
                        {s.booking ? 'Booked' : 'Open'}
                      </span>
                      <button onClick={() => remove(s)} className="text-sm text-warm-gray hover:text-red-600 transition-colors">
                        {s.booking ? 'Cancel' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
