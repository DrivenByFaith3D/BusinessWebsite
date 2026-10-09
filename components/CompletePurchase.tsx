'use client'
import { useEffect } from 'react'
import { useCart } from './CartProvider'
export default function CompletePurchase({
  sessionId,
  items,
}: {
  sessionId: string
  items: { cartKey: string | null; quantity: number }[]
}) {
  const { finishPurchase } = useCart()
  useEffect(() => {
    finishPurchase(sessionId, items)
  }, [finishPurchase, sessionId, items])
  return null
}
