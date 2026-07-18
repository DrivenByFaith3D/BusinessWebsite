import { NextRequest, NextResponse } from 'next/server'
import { head } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Authorized gateway to private order attachments. The blob itself is private;
// this route hands back a short-lived signed URL only if the caller owns the
// order the file belongs to (or is an admin).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const u = req.nextUrl.searchParams.get('u')
  if (!u) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const file = await prisma.fileUpload.findFirst({
    where: { url: u },
    select: { order: { select: { userId: true } } },
  })
  const msg = file
    ? null
    : await prisma.message.findFirst({ where: { fileUrl: u }, select: { order: { select: { userId: true } } } })

  const ownerId = file?.order.userId ?? msg?.order.userId
  if (!ownerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.user.role !== 'admin' && ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const meta = await head(u)
    return NextResponse.redirect(meta.downloadUrl)
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
  }
}
