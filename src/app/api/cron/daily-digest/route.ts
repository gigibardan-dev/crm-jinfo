/**
 * src/app/api/cron/daily-digest/route.ts
 *
 * GET/POST /api/cron/daily-digest — trimite digestul zilnic (agent +
 * echipă). NU e o pagină din UI — endpoint făcut să fie apelat o dată pe
 * zi de un scheduler/pinger extern (cron-job.org sau similar), la ora
 * aleasă de admin (ex. 11:00) — vezi nota din răspuns / discuția din chat
 * pt. cum se configurează pinger-ul.
 *
 * Autentificare: `CRON_SECRET` — EXACT același mecanism ca
 * /api/leads/sync/facebook-sheets (vezi acel fișier pt. detalii): header
 * `Authorization: Bearer <secret>`, header `x-cron-secret`, sau query
 * `?key=<secret>`. Fail closed dacă CRON_SECRET nu e setat.
 *
 * Switch general: dacă `email_notifications_enabled` (Setări → Email) e
 * oprit, endpoint-ul întoarce imediat `{ skipped: true, reason: 'disabled' }`
 * — NU interoghează leadurile, NU trimite nimic. Fiecare trimitere
 * individuală mai e verificată o dată în sendNotificationMail() (mod
 * testare inclus) — dublă plasă de siguranță, intenționat.
 *
 * Conținut (vezi src/lib/email/digest.ts pt. construirea HTML-ului):
 * - Agent: leadurile proprii — noi (ultimele 24h), critice (>96h fără
 *   interacțiune — STAGNANT_CRITICAL_HOURS), finalizate ieri.
 * - Manager: secțiunea personală (ca la agent, poate avea leaduri proprii
 *   din round-robin) + imaginea de ansamblu a echipei.
 * - Admin: doar imaginea de ansamblu a echipei (nu e în pool-ul de
 *   round-robin, nu are leaduri proprii de obicei).
 *
 * „Ieri" = ultimele 24h de la ora rulării (nu ținem timestamp de ultima
 * rulare) — vezi nota din digest.ts pt. limitări acceptate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailSettings } from '@/lib/email/emailSettings'
import { sendNotificationMail } from '@/lib/email/sendMail'
import { buildAgentDigestEmail, buildTeamDigestEmail, type AgentDigestData, type TeamDigestData, type DigestLeadSummary, type CriticalLeadSummary, type AgentPerfRow, type DigestEmail } from '@/lib/email/digest'
import { getStagnantInfo } from '@/lib/utils/stagnantLeads'
import { TERMINAL_STATUSES } from '@/lib/utils/constants'
import { fullName } from '@/lib/utils'

interface DigestLeadRow {
  id: string
  first_name: string | null
  last_name: string | null
  destination: string | null
  status: string
  assigned_to: string | null
  created_at: string
  last_interaction_at: string
}

interface ClosedLeadRow {
  id: string
  first_name: string | null
  last_name: string | null
  destination: string | null
  status: string
  assigned_to: string | null
  won_value: number | null
}

function toSummary(lead: { id: string; first_name: string | null; last_name: string | null; destination: string | null }): DigestLeadSummary {
  return { id: lead.id, name: fullName(lead.first_name, lead.last_name) || 'Fără nume', destination: lead.destination }
}

function buildAgentData(agentId: string, cutoff: Date, activeLeads: DigestLeadRow[], closedLast24h: ClosedLeadRow[]): AgentDigestData {
  const mine = activeLeads.filter((l) => l.assigned_to === agentId)
  const newLeads = mine.filter((l) => new Date(l.created_at) >= cutoff).map(toSummary)

  const critical: CriticalLeadSummary[] = []
  let warningStagnantCount = 0
  for (const lead of mine) {
    const info = getStagnantInfo(lead.status, lead.last_interaction_at)
    if (!info) continue
    if (info.isCritical) critical.push({ ...toSummary(lead), hoursLabel: info.label })
    else warningStagnantCount++
  }

  const closedMine = closedLast24h.filter((l) => l.assigned_to === agentId)

  return {
    newLeads,
    activeCount: mine.length,
    criticalStagnant: critical,
    warningStagnantCount,
    wonLast24h: closedMine.filter((l) => l.status === 'won').map(toSummary),
    lostLast24h: closedMine.filter((l) => l.status === 'lost').map(toSummary),
  }
}

function buildTeamData(
  cutoff: Date,
  activeLeads: DigestLeadRow[],
  closedLast24h: ClosedLeadRow[],
  agentProfiles: { id: string; full_name: string }[]
): TeamDigestData {
  const unassignedCount = activeLeads.filter((l) => !l.assigned_to).length
  const newLeadsCount = activeLeads.filter((l) => new Date(l.created_at) >= cutoff).length

  const won = closedLast24h.filter((l) => l.status === 'won')
  const lost = closedLast24h.filter((l) => l.status === 'lost')

  const nameById = new Map(agentProfiles.map((p) => [p.id, p.full_name]))
  const criticalStagnant: CriticalLeadSummary[] = []
  for (const lead of activeLeads) {
    const info = getStagnantInfo(lead.status, lead.last_interaction_at)
    if (!info?.isCritical) continue
    criticalStagnant.push({
      ...toSummary(lead),
      hoursLabel: info.label,
      agentName: lead.assigned_to ? nameById.get(lead.assigned_to) || null : null,
    })
  }

  const agentRows: AgentPerfRow[] = agentProfiles
    .map((p) => {
      const mine = activeLeads.filter((l) => l.assigned_to === p.id)
      const criticalCount = mine.filter((l) => getStagnantInfo(l.status, l.last_interaction_at)?.isCritical).length
      const newCount = mine.filter((l) => new Date(l.created_at) >= cutoff).length
      return { agentName: p.full_name, activeCount: mine.length, criticalCount, newCount }
    })
    .filter((row) => row.activeCount > 0 || row.newCount > 0)
    .sort((a, b) => b.activeCount - a.activeCount)

  return {
    newLeadsCount,
    unassignedCount,
    activeCount: activeLeads.length,
    wonLast24hCount: won.length,
    wonLast24hValueEur: won.reduce((sum, l) => sum + (l.won_value || 0), 0),
    lostLast24hCount: lost.length,
    criticalStagnant,
    agentRows,
  }
}

async function handleDigest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Lipsește CRON_SECRET din configurare — endpoint-ul e dezactivat până e setat.' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null
  const providedKey = bearerToken || request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('key')

  if (!providedKey || providedKey !== cronSecret) {
    return NextResponse.json({ error: 'Cheie invalidă sau lipsă.' }, { status: 401 })
  }

  const emailSettings = await getEmailSettings()
  if (!emailSettings.notificationsEnabled) {
    return NextResponse.json({ skipped: true, reason: 'disabled', note: 'Notificările automate sunt oprite din Setări → Email.' })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 3_600_000)

  const [{ data: profiles }, { data: activeLeads }, { data: closedLeads }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role').eq('is_active', true),
    supabase
      .from('leads')
      .select('id, first_name, last_name, destination, status, assigned_to, created_at, last_interaction_at')
      .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`),
    supabase
      .from('leads')
      .select('id, first_name, last_name, destination, status, assigned_to, won_value')
      .in('status', ['won', 'lost'])
      .gte('updated_at', cutoff.toISOString()),
  ])

  const allProfiles = profiles || []
  const activeLeadRows = (activeLeads || []) as DigestLeadRow[]
  const closedLeadRows = (closedLeads || []) as ClosedLeadRow[]

  const agentAndManagerProfiles = allProfiles.filter((p) => p.role === 'agent' || p.role === 'manager')
  const teamData = buildTeamData(cutoff, activeLeadRows, closedLeadRows, agentAndManagerProfiles)

  const results: { profileId: string; role: string; sent: boolean; reason?: string; error?: string; redirectedTo?: string }[] = []

  for (const profile of allProfiles) {
    let email: DigestEmail

    if (profile.role === 'agent') {
      const agentData = buildAgentData(profile.id, cutoff, activeLeadRows, closedLeadRows)
      email = buildAgentDigestEmail(profile.full_name, agentData)
    } else if (profile.role === 'manager') {
      const agentData = buildAgentData(profile.id, cutoff, activeLeadRows, closedLeadRows)
      email = buildTeamDigestEmail(teamData, { agentName: profile.full_name, data: agentData })
    } else if (profile.role === 'admin') {
      email = buildTeamDigestEmail(teamData)
    } else {
      continue
    }

    const result = await sendNotificationMail({ to: profile.email, subject: email.subject, html: email.html, text: email.text })

    if (result.sent) {
      results.push({ profileId: profile.id, role: profile.role, sent: true, redirectedTo: result.redirectedTo })
    } else if (result.reason === 'disabled') {
      // Switch-ul a fost oprit chiar în timpul rulării — oprim aici, restul rămân netrimise.
      results.push({ profileId: profile.id, role: profile.role, sent: false, reason: 'disabled' })
      break
    } else {
      results.push({ profileId: profile.id, role: profile.role, sent: false, reason: 'error', error: result.error })
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    testMode: emailSettings.testModeEnabled,
    recipients: results.length,
    sent: results.filter((r) => r.sent).length,
    results,
  })
}

export async function GET(request: NextRequest) {
  return handleDigest(request)
}

export async function POST(request: NextRequest) {
  return handleDigest(request)
}
