import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api'

// Admin: create an open consultation slot
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { startsAt, duration } = await req.json()
  const dur = Number(duration)
  if (!startsAt || ![15, 30].includes(dur)) {
    return NextResponse.json({ error: 'Pick a valid time and duration (15 or 30 min).' }, { status: 400 })
  }
  const starts = new Date(startsAt)
  if (isNaN(starts.getTime())) return NextResponse.json({ error: 'Invalid date/time.' }, { status: 400 })
  if (starts.getTime() < Date.now()) return NextResponse.json({ error: 'That time is in the past.' }, { status: 400 })

  const slot = await prisma.availabilitySlot.create({ data: { startsAt: starts, duration: dur } })
  return NextResponse.json(slot)
}

// Admin: delete a slot (cascades any booking on it)
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.availabilitySlot.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
