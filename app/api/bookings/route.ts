import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/brevo'
import { adminNotifyEmails } from '@/lib/notify'

// Customer: book an open slot (requires sign-in)
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { success } = await rateLimit(`booking:${session.user.id}`, 10, 60 * 60_000)
  if (!success) return NextResponse.json({ error: 'Too many booking attempts. Please try again later.' }, { status: 429 })

  const { slotId, name, topic } = await req.json()
  if (!slotId) return NextResponse.json({ error: 'Missing slot.' }, { status: 400 })

  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId }, include: { booking: true } })
  if (!slot) return NextResponse.json({ error: 'That time is no longer available.' }, { status: 404 })
  if (slot.booking) return NextResponse.json({ error: 'That time was just booked. Please choose another.' }, { status: 409 })
  if (slot.startsAt.getTime() < Date.now()) return NextResponse.json({ error: 'That time has already passed.' }, { status: 400 })

  const bookingName = (typeof name === 'string' && name.trim()) ? name.trim() : (session.user.name || session.user.email)

  let booking
  try {
    booking = await prisma.booking.create({
      data: {
        slotId,
        userId: session.user.id,
        name: bookingName,
        topic: (typeof topic === 'string' && topic.trim()) ? topic.trim() : null,
      },
    })
  } catch {
    // Unique constraint on slotId — someone booked it a moment ago
    return NextResponse.json({ error: 'That time was just booked. Please choose another.' }, { status: 409 })
  }

  // Notify admins (non-blocking)
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const when = slot.startsAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
    for (const to of await adminNotifyEmails()) {
      await sendEmail({
        to,
        subject: `New consultation booked — ${when}`,
        htmlContent: `<p><strong>${bookingName}</strong> (${session.user.email}) booked a ${slot.duration}-minute consultation.</p>`
          + `<p><strong>When:</strong> ${when}</p>`
          + (booking.topic ? `<p><strong>Topic:</strong> ${booking.topic}</p>` : '')
          + `<p><a href="${appUrl}/admin/availability">View your availability &amp; bookings</a></p>`,
      })
    }
  } catch (e) {
    console.error('Booking email failed:', e)
  }

  return NextResponse.json({ ok: true, booking })
}

// Cancel a booking (owner or admin)
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.user.role !== 'admin' && booking.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.booking.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
