import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import GalleryClient from './GalleryClient'

export const metadata: Metadata = { title: 'Gallery' }

export default async function GalleryPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'admin'

  const photos = await prisma.galleryPhoto.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, url: true, caption: true, category: true },
  })

  return <GalleryClient photos={photos} isAdmin={isAdmin} />
}
