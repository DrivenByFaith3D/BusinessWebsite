'use client'

import { useState } from 'react'
import { fileProxy } from '@/lib/files'

interface ChatMessage {
  id: string
  senderId: string
  content: string
  fileUrl: string | null
  createdAt: string
  senderEmail: string
  senderName: string | null
  senderRole: string
}

interface Props {
  message: ChatMessage
  isOwn: boolean
  groupWithPrev?: boolean
  onEdit: (messageId: string, newContent: string) => void
  onDelete: (messageId: string) => void
}

export default function MessageBubble({ message, isOwn, groupWithPrev, onEdit, onDelete }: Props) {
  const isAdminSender = message.senderRole === 'admin'
  const senderLabel = isAdminSender ? 'DrivenByFaith3D' : message.senderName || message.senderEmail?.split('@')[0] || 'You'
  const time = new Date(message.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const isOptimistic = message.id.startsWith('optimistic-')

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const [hovered, setHovered] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submitEdit() {
    if (!editValue.trim() || editValue.trim() === message.content) { setEditing(false); return }
    setSaving(true)
    await onEdit(message.id, editValue.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <div
      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} ${groupWithPrev ? 'mt-0.5' : 'mt-3'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!groupWithPrev && (
        <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs font-medium ${isAdminSender ? 'text-charcoal' : 'text-warm-gray'}`}>
            {senderLabel}
          </span>
          <span className="text-xs text-warm-gray">{time}</span>
        </div>
      )}

      <div className={`flex items-end gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
        {/* Edit/Delete actions, own messages only, not optimistic */}
        {isOwn && !isOptimistic && !editing && (
          <div className={`flex items-center gap-1 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={() => { setEditValue(message.content); setEditing(true) }}
              className="text-warm-gray hover:text-charcoal transition-colors p-1 rounded"
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(message.id)}
              className="text-warm-gray hover:text-red-500 transition-colors p-1 rounded"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-1.5 w-full max-w-xs sm:max-w-md lg:max-w-lg">
            <textarea
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
                if (e.key === 'Escape') { setEditing(false) }
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = el.scrollHeight + 'px'
                }
              }}
              className="input resize-none text-sm w-full"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs text-warm-gray hover:text-charcoal px-2 py-1">
                Cancel
              </button>
              <button onClick={submitEdit} disabled={saving} className="btn-primary text-xs px-3 py-1">
                {saving ? '…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className={`max-w-xs sm:max-w-md lg:max-w-lg px-4 py-2.5 text-sm leading-relaxed ${
            isOwn
              ? `bg-charcoal text-white ${groupWithPrev ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-br-md'}`
              : `bg-white border border-taupe text-charcoal ${groupWithPrev ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-bl-md'}`
          }`}>
            {message.content}
            {message.fileUrl && (
              <a href={fileProxy(message.fileUrl)} target="_blank" rel="noopener noreferrer"
                className={`mt-2 flex items-center gap-1 text-xs underline ${isOwn ? 'text-white/80 hover:text-white' : 'text-warm-gray hover:text-charcoal'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attached file
              </a>
            )}
          </div>
        )}
      </div>

      {groupWithPrev && !editing && (
        <span className="text-xs text-warm-gray mt-0.5 px-1">{time}</span>
      )}
    </div>
  )
}
