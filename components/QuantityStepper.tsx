'use client'

import { useEffect, useState } from 'react'

// Quantity control with working +/- buttons AND a typeable field. While editing,
// the field may be briefly empty; the value is clamped to [min, max] on blur or
// Enter. onChange fires only with a valid, clamped number.
export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  label = 'Quantity',
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  label?: string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  const commit = (raw: string) => {
    const n = Math.floor(Number(raw))
    if (!raw.trim() || Number.isNaN(n)) { setText(String(value)); return }
    const clamped = Math.min(max, Math.max(min, n))
    setText(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  const btn =
    size === 'sm'
      ? 'w-6 h-6 text-xs rounded-full border border-taupe'
      : 'w-9 h-9 rounded-full'
  const input = size === 'sm' ? 'w-8 text-sm' : 'w-12 text-sm'

  return (
    <div className={`flex items-center ${size === 'sm' ? 'gap-2' : 'border border-taupe/50 rounded-full overflow-hidden'}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className={`${btn} flex items-center justify-center text-charcoal hover:bg-taupe/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(text); (e.target as HTMLInputElement).blur() }
        }}
        aria-label={label}
        className={`${input} text-center font-medium text-charcoal bg-transparent border-0 focus:outline-none`}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className={`${btn} flex items-center justify-center text-charcoal hover:bg-taupe/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors`}
      >
        +
      </button>
    </div>
  )
}
