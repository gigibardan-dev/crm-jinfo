import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const body = await request.json()

    // Identify source by API key in header or body
    const apiKey = request.headers.get('x-api-key') || body.api_key
    
    let source = body.source || 'other'
    let sourceDetail = body.source_detail || null

    // If API key provided, look up the source
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

    // Deduplication: check email + phone in last 7 days
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
        // Duplicate found — add note to existing lead
        await supabase.from('lead_activities').insert({
          lead_id: existing[0].id,
          type: 'system',
          content: `Lead duplicat detectat din ${source}. Date originale: ${JSON.stringify(body)}`,
        })

        return NextResponse.json(
          { status: 'duplicate', lead_id: existing[0].id },
          { status: 200 }
        )
      }
    }

    // Create lead
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
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
        priority: body.priority || 'medium',
        status: 'new',
      })
      .select('id')
      .single()

    if (error || !lead) {
      return NextResponse.json(
        { error: 'Eroare la creare lead' },
        { status: 500 }
      )
    }

    // Log system activity
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'system',
      content: `Lead creat automat din ${sourceDetail || source}`,
    })

    // Notify all admins and managers
    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager'])
      .eq('is_active', true)

    if (managers && managers.length > 0) {
      const notifications = managers.map((m) => ({
        user_id: m.id,
        type: 'lead_new' as const,
        title: 'Lead nou nealocat',
        body: `${body.first_name || ''} ${body.last_name || ''} — ${body.destination || 'fără destinație'} (${sourceDetail || source})`,
        lead_id: lead.id,
      }))

      await supabase.from('notifications').insert(notifications)
    }

    return NextResponse.json(
      { status: 'created', lead_id: lead.id },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: 'Payload invalid' },
      { status: 400 }
    )
  }
}
