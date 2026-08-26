/**
 * src/lib/leads/chat-transcript.ts
 *
 * Formatare + salvare a transcriptului de conversație trimis de chatbot-ul
 * Jino „Carmen AI” odată cu un lead (`conversation[]` din payload-ul
 * POST /api/leads/inbound). Transcriptul e păstrat ca o singură intrare
 * „vie” în lead_activities (type 'system', metadata.kind: 'chat_transcript')
 * — la fiecare push se șterge varianta veche și se reinserează cea nouă,
 * ca să apară mereu sus, la zi, în timeline-ul lead-ului.
 * Extras din src/app/api/leads/inbound/route.ts.
 * Vezi și: claude/integrari-canale-status.md (secțiunea Jino chatbot).
 */

import type { createAdminClient } from '@/lib/supabase/admin'

export type ConvMsg = { role?: string; content?: string }

export function formatConversation(conversation: ConvMsg[]): string {
  return conversation
    .map((m) => `${m.role === 'assistant' ? '🤖 Carmen' : '👤 Client'}: ${m.content || ''}`)
    .join('\n')
}

// Inserează/actualizează intrarea "vie" cu transcriptul conversației pe un lead.
// Șterge varianta anterioară și reinserează, ca să apară mereu sus (cea mai recentă) în timeline.
export async function upsertConversationActivity(
  supabase: ReturnType<typeof createAdminClient>,
  leadId: string,
  conversation: ConvMsg[]
) {
  if (!Array.isArray(conversation) || conversation.length === 0) return

  await supabase
    .from('lead_activities')
    .delete()
    .eq('lead_id', leadId)
    .eq('type', 'system')
    .contains('metadata', { kind: 'chat_transcript' })

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'system' as const,
    content: formatConversation(conversation),
    metadata: { kind: 'chat_transcript', message_count: conversation.length },
  })
}
