import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const caption = formData.get('caption') as string | null
  const category = formData.get('category') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const filename = `gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const blob = await put(filename, file, { access: 'public', contentType: file.type || 'image/jpeg' })

  const photo = await prisma.galleryPhoto.create({
    data: { url: blob.url, caption: caption || null, category: category || null },
  })

  return NextResponse.json(photo)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.galleryPhoto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
