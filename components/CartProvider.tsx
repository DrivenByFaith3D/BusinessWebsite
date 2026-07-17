'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface CartItem {
  // Cart line key. A product with variations can appear more than once (one line
  // per colour), so the product id alone is not enough to identify a line.
  key: string
  productId: string
  variationId: string | null
  variationLabel: string | null
  name: string
  price: number
  imageUrl: string | null
  quantity: number
}

export interface AddItemInput {
  productId: string
  name: string
  price: number
  imageUrl: string | null
  variationId?: string | null
  variationLabel?: string | null
  quantity?: number
}

// Matches the server-side cap in the checkout route.
export const MAX_QTY = 99

interface CartContextType {
  items: CartItem[]
  addItem: (product: AddItemInput) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | null>(null)

const CART_KEY = 'dbf3d_cart'

const lineKey = (productId: string, variationId?: string | null) => `${productId}::${variationId ?? ''}`

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Drop anything saved before variations existed rather than trying to
        // migrate a half-known shape into a checkout.
        setItems(Array.isArray(parsed) ? parsed.filter((i) => i && i.productId && i.key) : [])
      }
    } catch {}
    setLoaded(true)
  }, [])

  // Persist cart to localStorage
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(CART_KEY, JSON.stringify(items))
    }
  }, [items, loaded])

  const addItem = useCallback((product: AddItemInput) => {
    const key = lineKey(product.productId, product.variationId)
    const adding = Math.max(1, Math.floor(product.quantity ?? 1))
    setItems(prev => {
      const existing = prev.find(item => item.key === key)
      if (existing) {
        return prev.map(item =>
          item.key === key
            ? { ...item, quantity: Math.min(MAX_QTY, item.quantity + adding) }
            : item
        )
      }
      return [...prev, {
        key,
        productId: product.productId,
        variationId: product.variationId ?? null,
        variationLabel: product.variationLabel ?? null,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: Math.min(MAX_QTY, adding),
      }]
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems(prev => prev.filter(item => item.key !== key))
  }, [])

  const updateQuantity = useCallback((key: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(item => item.key !== key))
    } else {
      setItems(prev => prev.map(item =>
        item.key === key ? { ...item, quantity: Math.min(MAX_QTY, Math.floor(quantity)) } : item
      ))
    }
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
