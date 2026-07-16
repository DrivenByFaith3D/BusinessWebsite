'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCart } from './CartProvider'

export default function CartDrawer() {
  const [open, setOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart()

  async function handleCheckout() {
    if (items.length === 0) return
    setCheckingOut(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/product-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: items.map(item => ({ productId: item.id, quantity: item.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout. Please try again.')
        setCheckingOut(false)
        return
      }
      clearCart()
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
      setCheckingOut(false)
    }
  }

  return (
    <>
      {/* Cart icon button */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 text-warm-gray hover:text-charcoal transition-colors"
        aria-label="Cart"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        {totalItems > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-charcoal text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center leading-none">
            {totalItems}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-cream border-l border-taupe/30 shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-taupe/30">
              <h2 className="text-lg font-display">Your Cart</h2>
              <button onClick={() => setOpen(false)} className="text-warm-gray hover:text-charcoal transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-warm-gray">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-4 items-start">
                      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-taupe/20 relative">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-warm-gray">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{item.name}</p>
                        <p className="text-sm text-charcoal/90">${item.price.toFixed(2)}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-full border border-taupe text-charcoal flex items-center justify-center text-xs hover:bg-taupe/20 transition-colors"
                          >
                            −
                          </button>
                          <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-full border border-taupe text-charcoal flex items-center justify-center text-xs hover:bg-taupe/20 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-warm-gray hover:text-charcoal transition-colors mt-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-taupe/30 px-6 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal/90">Subtotal</span>
                  <span className="text-lg font-display">${totalPrice.toFixed(2)}</span>
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="btn-primary w-full text-center disabled:opacity-50"
                >
                  {checkingOut ? 'Redirecting...' : 'Checkout'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
