import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database'

type LeadInsert = Database['public']['Tables']['leads']['Insert']
type LeadUpdate = Database['public']['Tables']['leads']['Update']
type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

// Origini browser cărora le este permis să apeleze acest endpoint direct din JS
// (server-to-server, ca worker-ul Cloudflare al chatbot-ului Jino, nu are nevoie de CORS).
const ALLOWED_ORIGINS = [
  'https://www.jinfotours.ro',
  'https://jinfotours.ro',
]

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return headers
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

// Scor de interes (0-100) → prioritate CRM. "urgent" rămâne mereu setat manual.
function scoreToPriority(score: number): 'low' | 'medium' | 'high' {
  if (score >= 60) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

type ConvMsg = { role?: string; content?: string }

function formatConversation(conversation: ConvMsg[]): string {
  return conversation
    .map((m) => `${m.role === 'assistant' ? '🤖 Carmen' : '👤 Client'}: ${m.content || ''}`)
    .join('\n')
}

// Inserează/actualizează intrarea "vie" cu transcriptul conversației pe un lead.
// Șterge varianta anterioară și reinserează, ca să apară mereu sus (cea mai recentă) în timeline.
async function upsertConversationActivity(
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

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const cors = corsHeaders(request.headers.get('origin'))

  try {
    const body = await request.json()

    const apiKey = request.headers.get('x-api-key') || body.api_key

    let source = body.source || 'other'
    let sourceDetail = body.source_detail || null

    if (apiKey) {
      const { data: leadSource } = await supabase
        .from('lead_sources')
        .select('slug, name')
        .eq('webhook_key', apiKey)
        .eq('is_active', true)
        .single()

      if (leadSource) {
        source = leadSource.slug
        sourceDetail = sourceDetail || leadSource.name
      }
    }

    // Deduplication
    if (body.email || body.phone) {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      let query = supabase
        .from('leads')
        .select('id')
        .gte('created_at', sevenDaysAgo.toISOString())

      if (body.email && body.phone) {
        query = query.or(`email.eq.${body.email},phone.eq.${body.phone}`)
      } else if (body.email) {
        query = query.eq('email', body.email)
      } else if (body.phone) {
        query = query.eq('phone', body.phone)
      }

      const { data: existing } = await query.limit(1)

      if (existing && existing.length > 0) {
        const existingId = existing[0].id

        // chat_ai: aceeași sesiune de chat trimite date tot mai bune pe măsură ce
        // conversația avansează — actualizăm lead-ul existent în loc să lăsăm doar o notă.
        if (source === 'chat_ai') {
          const updates: LeadUpdate = {}
          if (body.destination) updates.destination = body.destination
          if (body.budget_range) updates.budget_range = body.budget_range
          if (body.trip_type) updates.trip_type = body.trip_type
          if (body.message) updates.message = body.message
          if (typeof body.interest_score === 'number') updates.priority = scoreToPriority(body.interest_score)

          if (Object.keys(updates).length > 0) {
            await supabase.from('leads').update(updates).eq('id', existingId)
          }

          await supabase.from('lead_activities').insert({
            lead_id: existingId,
            type: 'system' as const,
            content: `Lead actualizat din chat AI${
              typeof body.interest_score === 'number' ? ` — scor ${body.interest_score}` : ''
            }${body.destination ? `, destinație: ${body.destination}` : ''}`,
          })

          if (Array.isArray(body.conversation)) {
            await upsertConversationActivity(supabase, existingId, body.conversation)
          }

          return NextResponse.json({ status: 'updated', lead_id: existingId }, { status: 200, headers: cors })
        }

        // Alte surse: comportament neschimbat — doar notă, fără suprascriere.
        await supabase.from('lead_activities').insert({
          lead_id: existingId,
          type: 'system' as const,
          content: `Lead duplicat detectat din ${source}. Date originale: ${JSON.stringify(body)}`,
        })

        return NextResponse.json(
          { status: 'duplicate', lead_id: existingId },
          { status: 200, headers: cors }
        )
      }
    }

    const leadData: LeadInsert = {
      first_name: body.first_name || body.name?.split(' ')[0] || null,
      last_name: body.last_name || body.name?.split(' ').slice(1).join(' ') || null,
      email: body.email || null,
      phone: body.phone || null,
      source,
      source_detail: sourceDetail,
      source_raw_data: body,
      destination: body.destination || null,
      travel_date_from: body.travel_date_from || null,
      travel_date_to: body.travel_date_to || null,
      nr_adults: body.nr_adults || 1,
      nr_children: body.nr_children || 0,
      children_ages: body.children_ages || null,
      budget_range: body.budget_range || null,
      trip_type: body.trip_type || null,
      message: body.message || null,
      priority: typeof body.interest_score === 'number' ? scoreToPriority(body.interest_score) : (body.priority || 'medium'),
      status: 'new',
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select('id')
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Eroare la creare lead' }, { status: 500, headers: cors })
    }

    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'system' as const,
      content: `Lead creat automat din ${sourceDetail || source}`,
    })

    if (Array.isArray(body.conversation)) {
      await upsertConversationActivity(supabase, lead.id, body.conversation)
    }

    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager'])
      .eq('is_active', true)

    if (managers && managers.length > 0) {
      const notifications: NotificationInsert[] = managers.map((m) => ({
        user_id: m.id,
        type: 'lead_new' as const,
        title: 'Lead nou nealocat',
        body: `${body.first_name || ''} ${body.last_name || ''} — ${body.destination || 'fără destinație'} (${sourceDetail || source})`,
        lead_id: lead.id,
      }))

      await supabase.from('notifications').insert(notifications)
    }

    return NextResponse.json({ status: 'created', lead_id: lead.id }, { status: 201, headers: cors })
  } catch {
    return NextResponse.json({ error: 'Payload invalid' }, { status: 400, headers: cors })
  }
}