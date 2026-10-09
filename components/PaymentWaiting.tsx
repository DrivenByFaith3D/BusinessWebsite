'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
export default function PaymentWaiting() {
  const router = useRouter()
  const [attempts, setAttempts] = useState(0)
  useEffect(() => {
    if (attempts >= 10) return
    const timer = setTimeout(() => {
      setAttempts((n) => n + 1)
      router.refresh()
    }, 3000)
    return () => clearTimeout(timer)
  }, [attempts, router])
  return (
    <button className="btn-secondary mt-4" onClick={() => router.refresh()}>
      Check payment status
    </button>
  )
}
