/**
 * src/components/leads/lead-detail/CommentForm.tsx
 *
 * CommentForm
 *
 * Formular scurt (textarea + buton „Trimite”) pentru adăugarea unui
 * comentariu/notă internă pe un lead. Fără state propriu — primește
 * valoarea curentă și handlerii din pagina de detaliu lead.
 * Extras din src/app/(app)/leads/[id]/page.tsx — comportament identic.
 */

'use client'

import { Send } from 'lucide-react'

interface CommentFormProps {
  comment: string
  onCommentChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  sending: boolean
}

export function CommentForm({ comment, onCommentChange, onSubmit, sending }: CommentFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <textarea value={comment} onChange={(e) => onCommentChange(e.target.value)} rows={2}
        placeholder="Scrie o notă sau comentariu..."
        className="w-full text-sm bg-transparent border-0 focus:ring-0 resize-none placeholder:text-slate-400 p-0 text-slate-900 dark:text-slate-100" />
      <div className="flex justify-end mt-2">
        <button type="submit" disabled={!comment.trim() || sending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 transition-colors">
          <Send size={12} /> Trimite
        </button>
      </div>
    </form>
  )
}
