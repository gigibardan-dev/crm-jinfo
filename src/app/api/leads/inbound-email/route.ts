/**
 * src/app/api/leads/inbound-email/route.ts
 *
 * POST /api/leads/inbound-email — leaduri din emailuri de forward (agent →
 * client), primite prin Make.com (Custom Mailhook → modul HTTP → acest
 * endpoint). Nu e canalul „email” generic din `lead_sources` — e specific
 * fluxului „agentul dă forward la un email de cerere”, de-asta are propriul
 * secret, la fel ca `sync/facebook-sheets` (nu e un webhook_key din DB, ci o
 * variabilă de mediu dedicată — vezi raționamentul acolo).
 *
 * Payload (Raw JSON, trimis de Make.com):
 *   { expeditor: string, subiect: string, continut: string }
 * `continut` = corpul complet al firului de email (forward-ul agentului +
 * mesajul original al clientului, cu tot cu istoricul de thread).
 *
 * Flux:
 * 1. Auth: `?key=` (sau header `x-inbound-email-secret` / `Authorization:
 *    Bearer`, pentru consistență cu restul rutelor „trigger”) trebuie să
 *    coincidă cu `INBOUND_EMAIL_SECRET`. Fail closed dacă variabila nu e
 *    setată — la fel ca `CRON_SECRET` în sync/facebook-sheets.
 * 2. Extragere AI (Groq, `extractLeadFromEmail`): trimite `continut` cu JSON
 *    Schema strict (`response_format: json_schema, strict: true`) — modelul
 *    e OBLIGAT să respecte forma exactă a schemei, deci nu mai există risc
 *    de markdown/text în plus sau JSON malformat de parsat cu retry-uri.
 * 3. Deduplicare: ACELAȘI motor ca restul canalelor (email/telefon, fereastră
 *    7 zile — vezi `/api/leads/inbound`), NU dedup-ul Facebook (care se
 *    bazează pe un id extern stabil per lead — aici nu există așa ceva,
 *    fiecare email e text liber). La duplicat: doar o notă în timeline,
 *    fără suprascriere — comportamentul standard pentru orice sursă în
 *    afară de chat_ai.
 * 4. Insert lead (sursă „email”, deja suportată în UI — SourceIcon, filtre)
 *    + activitate de sistem + notificare admin/manager, la fel ca la
 *    celelalte canale.
 *
 * Zero leaduri pierdute — dar și zero leaduri „goale" trecute drept normale:
 * NU inserăm niciodată tăcut, cu prioritate medie și mesaj gol, în DOUĂ
 * situații (`needsReview`, vezi cod): (a) Groq eșuează (rate limit, model
 * indisponibil, JSON invalid) SAU (b) Groq răspunde tehnic valid dar n-a găsit
 * nimic util — `isMostlyEmpty`, ex. email spam/fără sens, toate câmpurile
 * null. În ambele cazuri inserăm lead-ul oricum (nu aruncăm cererea), dar cu
 * textul brut în `message`, prioritate `high` și tag `revizuire-ai`, ca un
 * agent să-l revizuiască manual — mai bine un lead „urât" în inbox decât unul
 * pierdut sau unul care se pierde tăcut printre cele normale.
 *
 * Variabile de mediu necesare: GROQ_API_KEY, INBOUND_EMAIL_SECRET.
 * Vezi și: claude/integrari-canale-status.md (secțiunea 5, canalul email).
 */

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@/lib/types/database'

type LeadInsert = Database['public']['Tables']['leads']['Insert']
type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

// openai/gpt-oss-20b: cel mai rapid model Groq (~1000 tok/s) care suportă
// JSON Schema strict — suficient pentru o extragere de 5 câmpuri, ieftin.
// Alternativă validă, dacă vreți alt „stil” de extragere: qwen/qwen3.8-27b
// (suportă și el strict:true, dar e mai lent/scump — vezi console.groq.com/docs/models).
const GROQ_MODEL = 'openai/gpt-oss-20b'

// Domenii interne (agenți JinfoTours) — orice adresă de pe aceste domenii e
// IGNORATĂ ca posibil "email client", peste tot unde extragem/validăm un
// email de client (prompt AI, schema, fallback regex). @jinfotours.ro =
// agenții „clasici"; @jinfocruise.ro = agenții de pe platforma de croaziere
// (adăugat de Gigi — mesajele de acolo pot fi forward-uite la fel).
const INTERNAL_EMAIL_DOMAINS = ['@jinfotours.ro', '@jinfocruise.ro']

function isInternalEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return INTERNAL_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain))
}

interface EmailExtraction {
  nume_client: string | null
  email_client: string | null
  telefon_client: string | null
  destinatie: string | null
  rezumat: string
}

// JSON Schema cu strict:true — Groq GARANTEAZĂ (constrained decoding) că
// răspunsul respectă exact această formă, deci nu mai trebuie validat/reîncercat
// manual ca la un simplu response_format:"json_object". Cerință strict mode:
// toate câmpurile trebuie în `required` (cele opționale devin nullable prin
// `type: [..., "null"]` în loc să lipsească) + `additionalProperties: false`.
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    nume_client: {
      type: ['string', 'null'],
      description: 'Numele complet al CLIENTULUI FINAL care a făcut cererea inițială — niciodată numele agentului JinfoTours care a dat forward. Extrage-l din semnătura sau corpul mesajului original, mai jos în thread.',
    },
    email_client: {
      type: ['string', 'null'],
      description: `Adresa de email a clientului final. IGNORĂ complet orice adresă ${INTERNAL_EMAIL_DOMAINS.join(' sau ')} — acelea aparțin agenților interni, niciodată clienților.`,
    },
    telefon_client: {
      type: ['string', 'null'],
      description: 'Numărul de telefon al clientului final, dacă apare undeva în text (semnătură, corp mesaj).',
    },
    destinatie: {
      type: ['string', 'null'],
      description: 'Destinația sau produsul turistic cerut de client, cât mai concis — ex: "MSC Magnifica", "Turcia, Antalya", "Grecia, Santorini".',
    },
    rezumat: {
      type: 'string',
      description: 'Un rezumat de 1-2 propoziții, în română, al cererii clientului (ce vrea, când, pentru câte persoane, dacă se știe).',
    },
  },
  required: ['nume_client', 'email_client', 'telefon_client', 'destinatie', 'rezumat'],
  additionalProperties: false,
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function extractLeadFromEmail(continut: string): Promise<EmailExtraction> {
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Ești un asistent care extrage date structurate din emailuri de forward, trimise de agenți turistici de la JinfoTours către un CRM intern. ' +
          'Emailul conține de obicei un fir de conversație (thread): mesajul cel mai recent (de sus) e forward-ul agentului, iar mai jos e mesajul ORIGINAL al clientului final — pe acela îl analizezi. ' +
          `Extrage datele clientului final, NICIODATĂ ale agentului care a dat forward. Ignoră complet orice adresă de email care se termină în ${INTERNAL_EMAIL_DOMAINS.join(' sau ')} — acelea sunt mereu ale agenților interni. ` +
          'Dacă un câmp nu apare clar în text, întoarce null pentru el — nu inventa date. Răspunde STRICT în formatul JSON cerut.',
      },
      { role: 'user', content: continut },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'lead_extraction',
        strict: true,
        schema: EXTRACTION_SCHEMA,
      },
    },
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) throw new Error('Groq a răspuns fără conținut.')
  return JSON.parse(raw) as EmailExtraction
}

// Fallback ieftin, fără AI — folosit doar când Groq eșuează (nu blocăm
// crearea lead-ului din cauza unei erori de model), ca să nu pierdem măcar
// un email de contact evident din text.
function fallbackEmailFromText(text: string): string | null {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  return matches.find((m) => !isInternalEmail(m)) || null
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  // --- 1. Autentificare (fail closed dacă secretul nu e configurat) ---
  const secret = process.env.INBOUND_EMAIL_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Lipsește INBOUND_EMAIL_SECRET din configurare — endpoint-ul e dezactivat până e setat.' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null
  const providedKey = request.nextUrl.searchParams.get('key') || request.headers.get('x-inbound-email-secret') || bearerToken

  if (!providedKey || providedKey !== secret) {
    return NextResponse.json({ error: 'Cheie invalidă sau lipsă.' }, { status: 401 })
  }

  // --- 2. Payload ---
  let body: { expeditor?: string; subiect?: string; continut?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload invalid — JSON așteptat.' }, { status: 400 })
  }

  const expeditor = typeof body.expeditor === 'string' ? body.expeditor.trim() : null
  const subiect = typeof body.subiect === 'string' ? body.subiect.trim() : null
  const continut = typeof body.continut === 'string' ? body.continut.trim() : ''

  if (!continut) {
    return NextResponse.json({ error: 'Lipsește câmpul "continut".' }, { status: 400 })
  }
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Lipsește GROQ_API_KEY din configurare.' }, { status: 500 })
  }

  // --- 3. Extragere AI — cu fallback dacă Groq eșuează, ca să nu pierdem lead-ul ---
  let extraction: EmailExtraction | null = null
  let extractionError: string | null = null
  try {
    extraction = await extractLeadFromEmail(continut)
  } catch (err) {
    extractionError = err instanceof Error ? err.message : 'Eroare necunoscută la extragerea AI.'
  }

  const emailClient = extraction?.email_client || fallbackEmailFromText(continut)
  const phoneClient = extraction?.telefon_client || null

  // Groq poate răspunde tehnic „cu succes" dar fără să fi găsit nimic util
  // (email fără sens, spam, thread nereușit de parcurs) — un JSON valid cu
  // toate câmpurile null nu înseamnă că avem un lead utilizabil. Tratăm asta
  // la fel ca o eșec de extragere: lead flagged pentru revizuire manuală,
  // NU inserat tăcut cu prioritate medie și mesaj gol.
  const isMostlyEmpty = !!extraction && !extraction.nume_client && !emailClient && !phoneClient && !extraction.destinatie
  const needsReview = !extraction || isMostlyEmpty

  // --- 4. Deduplicare — email/telefon, fereastră 7 zile (motorul standard,
  // identic cu /api/leads/inbound; NU dedup-ul pe id stabil de la Facebook,
  // care nu are corespondent aici — un forward de email n-are un id extern). ---
  if (emailClient || phoneClient) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    let query = supabase.from('leads').select('id').gte('created_at', sevenDaysAgo.toISOString())
    if (emailClient && phoneClient) {
      query = query.or(`email.eq.${emailClient},phone.eq.${phoneClient}`)
    } else if (emailClient) {
      query = query.eq('email', emailClient)
    } else {
      query = query.eq('phone', phoneClient as string)
    }

    const { data: existing } = await query.limit(1)
    if (existing && existing.length > 0) {
      const existingId = existing[0].id
      await supabase.from('lead_activities').insert({
        lead_id: existingId,
        type: 'system' as const,
        content: `Lead duplicat detectat din forward email (agent: ${expeditor || 'necunoscut'}). Cerere: ${
          extraction?.rezumat || subiect || 'fără subiect'
        }.`,
      })
      return NextResponse.json({ status: 'duplicate', lead_id: existingId }, { status: 200 })
    }
  }

  // --- 5. Insert lead ---
  // needsReview acoperă DOUĂ situații distincte, cu același tratament (prioritate
  // high, tag revizuire-ai, text brut în message): Groq a eșuat (extraction === null)
  // SAU Groq a răspuns valid dar n-a găsit nimic util (isMostlyEmpty) — un email
  // fără sens/spam nu trebuie să iasă ca un lead „normal", cu mesaj gol.
  const sourceDetail = `Forward agent — ${expeditor || 'necunoscut'}`
  const leadData: LeadInsert = needsReview
    ? {
        first_name: extraction?.nume_client?.split(' ')[0] || null,
        last_name: extraction?.nume_client?.split(' ').slice(1).join(' ') || null,
        email: emailClient,
        phone: phoneClient,
        source: 'email',
        source_detail: sourceDetail,
        source_raw_data: {
          expeditor, subiect, continut,
          ai_model: extraction ? GROQ_MODEL : null,
          ai_extraction: extraction,
          ai_error: extractionError,
          extracted_at: new Date().toISOString(),
        } as unknown as Json,
        destination: extraction?.destinatie || null,
        message: `[Date lipsă - necesită citire manuală]\n\n${continut}`,
        nr_adults: 1,
        priority: 'high',
        tags: ['revizuire-ai'],
        status: 'new',
        eligible_for_auto_assign: true, // lead nou organic (email forward) — vezi 005_round_robin_auto_assign.sql
      }
    : {
        first_name: extraction!.nume_client?.split(' ')[0] || null,
        last_name: extraction!.nume_client?.split(' ').slice(1).join(' ') || null,
        email: emailClient,
        phone: phoneClient,
        source: 'email',
        source_detail: sourceDetail,
        source_raw_data: {
          expeditor, subiect, continut,
          ai_model: GROQ_MODEL, ai_extraction: extraction,
          extracted_at: new Date().toISOString(),
        } as unknown as Json,
        destination: extraction!.destinatie || null,
        message: extraction!.rezumat,
        nr_adults: 1,
        priority: 'medium',
        status: 'new',
        eligible_for_auto_assign: true, // lead nou organic (email forward) — vezi 005_round_robin_auto_assign.sql
      }

  const { data: lead, error } = await supabase.from('leads').insert(leadData).select('id').single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Eroare la creare lead.' }, { status: 500 })
  }

  await supabase.from('lead_activities').insert({
    lead_id: lead.id,
    type: 'system' as const,
    content: !needsReview
      ? `Lead creat automat din forward email (agent: ${expeditor || 'necunoscut'}) — extras cu AI (Groq, ${GROQ_MODEL}).`
      : !extraction
        ? `Lead creat din forward email (agent: ${expeditor || 'necunoscut'}) — extragerea AI a eșuat (${extractionError}), necesită revizuire manuală.`
        : `Lead creat din forward email (agent: ${expeditor || 'necunoscut'}) — AI n-a găsit date esențiale în text (nume/email/telefon/destinație), necesită revizuire manuală.`,
  })

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
      body: `${leadData.first_name || ''} ${leadData.last_name || ''} — ${leadData.destination || 'fără destinație'} (email, ${expeditor || 'agent necunoscut'})`,
      lead_id: lead.id,
    }))
    await supabase.from('notifications').insert(notifications)
  }

  return NextResponse.json(
    { status: needsReview ? 'created_needs_review' : 'created', lead_id: lead.id },
    { status: 201 }
  )
}
