'use client'

/**
 * SearchDialog - Global lead search (Cmd+K / Ctrl+K)
 * 
 * Searches leads by: name, phone, email, destination
 * Shows results with source icon, status, and priority
 * Click result → navigate to lead detail
 * 
 * Triggered from Header search button or keyboard shortcut
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SourceIcon } from '@/components/leads/SourceIcon'
import { PriorityBadge } from '@/components/leads/PriorityBadge'
import type { Lead } from '@/lib/types/database'
import { fullName, formatPhone, timeAgo } from '@/lib/utils'
import { Search, X, ArrowRight, Loader2 } from 'lucide-react'

interface SearchDialogProps {
  open: boolean
  onClose: () => void
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search with debounce
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)

      // Search across multiple fields using OR
      const searchTerm = `%${query}%`
      const { data } = await supabase
        .from('leads')
        .select('*')
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm},destination.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(10)

      setResults(data || [])
      setSelectedIndex(0)
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, supabase])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      navigateToLead(results[selectedIndex].id)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [results, selectedIndex, onClose])

  function navigateToLead(leadId: string) {
    onClose()
    router.push(`/leads/${leadId}`)
  }

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800">
            <Search size={18} className="text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Caută leaduri (nume, telefon, email, destinație)..."
              className="flex-1 py-3.5 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            {loading && <Loader2 size={16} className="text-slate-400 animate-spin" />}
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {query.length >= 2 && results.length === 0 && !loading && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                Niciun rezultat pentru „{query}"
              </div>
            )}

            {query.length < 2 && (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                Introdu minim 2 caractere pentru a căuta
              </div>
            )}

            {results.map((lead, index) => (
              <button
                key={lead.id}
                onClick={() => navigateToLead(lead.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <SourceIcon source={lead.source} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {fullName(lead.first_name, lead.last_name)}
                    </span>
                    <PriorityBadge priority={lead.priority} size="sm" showLabel={false} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lead.destination && <span>{lead.destination}</span>}
                    {lead.phone && <span>{formatPhone(lead.phone)}</span>}
                    {lead.email && <span className="truncate">{lead.email}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-slate-400">{timeAgo(lead.created_at)}</span>
                  <ArrowRight size={14} className="text-slate-300 dark:text-slate-600" />
                </div>
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">↑↓</kbd> navigare
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">Enter</kbd> deschide
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">Esc</kbd> închide
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
