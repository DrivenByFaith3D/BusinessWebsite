import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AvailabilityClient from './AvailabilityClient'

export const metadata: Metadata = { title: 'Availability' }

export const dynamic = 'force-dynamic'

export default async function AdminAvailabilityPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  const slots = await prisma.availabilitySlot.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { startsAt: 'asc' },
    include: { booking: { include: { user: { select: { email: true } } } } },
  })

  const initial = slots.map((s) => ({
    id: s.id,
    startsAt: s.startsAt.toISOString(),
    duration: s.duration,
    booking: s.booking
      ? { id: s.booking.id, name: s.booking.name, topic: s.booking.topic, email: s.booking.user.email }
      : null,
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-charcoal">Availability</h1>
        <p className="text-warm-gray text-sm mt-1">Add open consultation times. Customers can book any open slot from the booking page.</p>
      </div>
      <AvailabilityClient initialSlots={initial} />
    </div>
  )
}
