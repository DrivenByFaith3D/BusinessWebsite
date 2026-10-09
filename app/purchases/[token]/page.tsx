import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PurchaseReceipt from '@/components/PurchaseReceipt'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Receipt and tracking', robots: { index: false, follow: false } }
export default async function PurchasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[a-f0-9]{48}$/.test(token)) notFound()
  const order = await prisma.shopOrder.findUnique({
    where: { confirmationToken: token },
    include: { items: true },
  })
  if (!order || !order.paidAt) notFound()
  return <PurchaseReceipt order={order} />
}
