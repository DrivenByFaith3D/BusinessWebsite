'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface CartItem {
  id: string
  name: string
  price: number
  imageUrl: string | null
  quantity: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (product: { id: string; name: string; price: number; imageUrl: string | null }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | null>(null)

const CART_KEY = 'dbf3d_cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY)
      if (saved) setItems(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  // Persist cart to localStorage
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(CART_KEY, JSON.stringify(items))
    }
  }, [items, loaded])

  const addItem = useCallback((product: { id: string; name: string; price: number; imageUrl: string | null }) => {
    setItems(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(item => item.id !== id))
    } else {
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, quantity } : item
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
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
