/**
 * src/lib/email/digest.ts
 *
 * Digest zilnic — construirea conținutului (HTML/text) pt. cele două
 * tipuri de mail trimise de src/app/api/cron/daily-digest/route.ts:
 *
 * - Digest agent (rol `agent`): TOATE leadurile lui deschise (active),
 *   grupate pe etapa curentă din pipeline — nu doar un rezumat. Fiecare
 *   lead arată de cât timp n-a mai avut interacțiune, colorat (roșu ≥96h —
 *   STAGNANT_CRITICAL_HOURS, portocaliu ≥48h — STAGNANT_THRESHOLD_HOURS),
 *   plus un marcaj „🆕" pt. cele nou-asignate în ultimele 24h. Sub grupe,
 *   ce s-a finalizat ieri (câștigat/fără succes).
 * - Digest echipă (rol `admin`/`manager`): imagine de ansamblu — leaduri
 *   noi/nealocate, pipeline activ, câștigate/fără succes de ieri (valoare
 *   inclusă), toate leadurile critice (cu agentul lor), un rând per agent
 *   (activ/critic/nou). Manager, spre deosebire de admin, poate avea și
 *   leaduri proprii (e în pool-ul de round-robin) — digestul lui include
 *   ȘI secțiunea personală (grupată pe etapă, ca la agent), înaintea
 *   imaginii de ansamblu. Rămâne neschimbat față de agent — vezi discuția
 *   din chat, urmează să fie rafinat separat.
 *
 * Funcțiile de-aici sunt PURE — iau date deja agregate din route.ts (care
 * face query-urile Supabase) și întorc { subject, html, text }. Stilul
 * HTML e intenționat simplu (tabele, inline styles) — compatibil cu
 * clienți de mail, în același spirit ca template-ul din
 * /api/email/test (system-ui, paleta slate).
 *
 * Data „de ieri" = ultimele 24h de la ora rulării (aproximare rezonabilă,
 * nu ținem un timestamp „ultima rulare"); pt. câștigat/fără succes folosim
 * `updated_at` (nu există un `won_at`/`lost_at` dedicat în schemă), deci un
 * lead redeschis și re-închis în aceeași zi ar apărea din nou — acceptabil,
 * foarte rar în practică.
 */

import { formatEur } from '@/lib/utils/reports'

export interface DigestLeadSummary {
  id: string
  name: string
  destination: string | null
}

export interface CriticalLeadSummary extends DigestLeadSummary {
  hoursLabel: string
  agentName?: string | null
}

export interface StageLeadRow extends DigestLeadSummary {
  hoursLabel: string
  isNew: boolean
  isCritical: boolean
  isWarning: boolean
}

export interface StageGroup {
  stageName: string
  leads: StageLeadRow[]
}

export interface AgentDigestData {
  /** Toate leadurile active ale agentului, grupate pe etapă (ordinea pipeline-ului), etapele fără leaduri fiind omise. */
  stageGroups: StageGroup[]
  activeCount: number
  newCount: number
  criticalCount: number
  warningCount: number
  wonLast24h: DigestLeadSummary[]
  lostLast24h: DigestLeadSummary[]
}

export interface AgentPerfRow {
  agentName: string
  activeCount: number
  criticalCount: number
  newCount: number
}

export interface TeamDigestData {
  newLeadsCount: number
  unassignedCount: number
  activeCount: number
  wonLast24hCount: number
  wonLast24hValueEur: number
  lostLast24hCount: number
  criticalStagnant: CriticalLeadSummary[]
  agentRows: AgentPerfRow[]
}

export interface DigestEmail {
  subject: string
  html: string
  text: string
}

// ============================================
// Shell HTML comun
// ============================================

function leadRow(lead: DigestLeadSummary, extra?: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#0f172a;font-size:13px">${lead.name}${lead.destination ? ` <span style="color:#94a3b8">— ${lead.destination}</span>` : ''}</td>
    ${extra ? `<td style="padding:6px 0 6px 12px;text-align:right;font-size:12px;color:#64748b;white-space:nowrap">${extra}</td>` : ''}
  </tr>`
}

function stageLeadRow(lead: StageLeadRow): string {
  const badge = lead.isNew ? '<span style="color:#2563eb;font-weight:600">🆕 </span>' : ''
  const ageColor = lead.isCritical ? '#dc2626' : lead.isWarning ? '#d97706' : '#94a3b8'
  const ageWeight = lead.isCritical ? '700' : '400'
  return `<tr>
    <td style="padding:6px 0;color:#0f172a;font-size:13px">${badge}${lead.name}${lead.destination ? ` <span style="color:#94a3b8">— ${lead.destination}</span>` : ''}</td>
    <td style="padding:6px 0 6px 12px;text-align:right;font-size:12px;color:${ageColor};font-weight:${ageWeight};white-space:nowrap">de ${lead.hoursLabel}</td>
  </tr>`
}

function section(title: string, innerHtml: string, accentColor = '#2563eb'): string {
  return `
    <div style="margin:0 0 20px">
      <h2 style="margin:0 0 8px;font-size:13px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.03em">${title}</h2>
      ${innerHtml}
    </div>`
}

function emptyNote(text: string): string {
  return `<p style="margin:0;font-size:13px;color:#94a3b8">${text}</p>`
}

function shell(preheader: string, bodyHtml: string): string {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto">
      <p style="display:none;max-height:0;overflow:hidden">${preheader}</p>
      <div style="padding:20px 0 12px;border-bottom:2px solid #2563eb;margin-bottom:20px">
        <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a">JinfoTours CRM</p>
        <p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Digest zilnic</p>
      </div>
      ${bodyHtml}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:11px;color:#94a3b8">Poți opri aceste mailuri oricând din CRM → Setări → Control notificări email.</p>
      </div>
    </div>`
}

// ============================================
// Digest agent (și secțiunea personală din digestul de manager)
// ============================================

function agentSectionsHtml(data: AgentDigestData): string {
  const parts: string[] = []

  const summaryBits = [`<strong style="color:#0f172a">${data.activeCount}</strong> leaduri deschise`]
  if (data.newCount > 0) summaryBits.push(`<span style="color:#2563eb">${data.newCount} noi</span>`)
  if (data.criticalCount > 0) summaryBits.push(`<span style="color:#dc2626;font-weight:600">${data.criticalCount} critice (≥96h)</span>`)
  if (data.warningCount > 0) summaryBits.push(`<span style="color:#d97706">${data.warningCount} de urmărit (≥48h)</span>`)
  parts.push(`<p style="margin:0 0 20px;font-size:13px;color:#64748b">${summaryBits.join(' · ')}</p>`)

  if (data.stageGroups.length === 0) {
    parts.push(emptyNote('Niciun lead deschis momentan.'))
  } else {
    for (const group of data.stageGroups) {
      parts.push(section(
        `${group.stageName} (${group.leads.length})`,
        `<table style="width:100%;border-collapse:collapse">${group.leads.map(stageLeadRow).join('')}</table>`
      ))
    }
  }

  const closedRows = [
    ...data.wonLast24h.map((l) => leadRow(l, '✓ câștigat')),
    ...data.lostLast24h.map((l) => leadRow(l, '✕ fără succes')),
  ]
  if (closedRows.length > 0) {
    parts.push(section(
      `Finalizate ieri (${data.wonLast24h.length + data.lostLast24h.length})`,
      `<table style="width:100%;border-collapse:collapse">${closedRows.join('')}</table>`
    ))
  }

  return parts.join('')
}

function agentDigestText(agentName: string, data: AgentDigestData): string {
  const lines = [`Digest zilnic JinfoTours CRM — ${agentName}`, ``]

  const summaryBits = [`${data.activeCount} leaduri deschise`]
  if (data.newCount > 0) summaryBits.push(`${data.newCount} noi`)
  if (data.criticalCount > 0) summaryBits.push(`${data.criticalCount} critice (≥96h)`)
  if (data.warningCount > 0) summaryBits.push(`${data.warningCount} de urmărit (≥48h)`)
  lines.push(summaryBits.join(', '), ``)

  for (const group of data.stageGroups) {
    lines.push(`${group.stageName} (${group.leads.length}):`)
    for (const lead of group.leads) {
      lines.push(`  ${lead.isNew ? '[NOU] ' : ''}${lead.name}${lead.destination ? ' — ' + lead.destination : ''} — de ${lead.hoursLabel}`)
    }
    lines.push(``)
  }

  if (data.wonLast24h.length + data.lostLast24h.length > 0) {
    lines.push(`Finalizate ieri: ${data.wonLast24h.length} câștigate, ${data.lostLast24h.length} fără succes`)
  }

  return lines.join('\n')
}

export function buildAgentDigestEmail(agentName: string, data: AgentDigestData): DigestEmail {
  const bits = [`${data.activeCount} leaduri deschise`]
  if (data.criticalCount > 0) bits.push(`${data.criticalCount} critice`)

  return {
    subject: `Digest zilnic — ${bits.join(', ')}`,
    html: shell(
      bits.join(', '),
      `<p style="margin:0 0 20px;font-size:14px;color:#0f172a">Bună, ${agentName}. Iată leadurile tale deschise:</p>${agentSectionsHtml(data)}`
    ),
    text: agentDigestText(agentName, data),
  }
}

// ============================================
// Digest echipă (admin/manager)
// ============================================

function teamSectionHtml(data: TeamDigestData): string {
  const parts: string[] = []

  parts.push(`
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
      <tr>
        <td style="padding:10px;background:#f8fafc;border-radius:8px 0 0 8px;text-align:center">
          <p style="margin:0;font-size:20px;font-weight:700;color:#0f172a">${data.newLeadsCount}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Leaduri noi</p>
        </td>
        <td style="padding:10px;background:#f8fafc;text-align:center">
          <p style="margin:0;font-size:20px;font-weight:700;color:${data.unassignedCount > 0 ? '#d97706' : '#0f172a'}">${data.unassignedCount}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Nealocate</p>
        </td>
        <td style="padding:10px;background:#f8fafc;text-align:center">
          <p style="margin:0;font-size:20px;font-weight:700;color:#0f172a">${data.activeCount}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Active</p>
        </td>
        <td style="padding:10px;background:#f8fafc;border-radius:0 8px 8px 0;text-align:center">
          <p style="margin:0;font-size:20px;font-weight:700;color:${data.criticalStagnant.length > 0 ? '#dc2626' : '#0f172a'}">${data.criticalStagnant.length}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Critice</p>
        </td>
      </tr>
    </table>`)

  parts.push(section(
    'Finalizate ieri',
    `<p style="margin:0;font-size:13px;color:#0f172a">${data.wonLast24hCount} câștigate (${formatEur(data.wonLast24hValueEur)}) · ${data.lostLast24hCount} fără succes</p>`
  ))

  parts.push(section(
    `Leaduri critice — fără interacțiune de peste 96h (${data.criticalStagnant.length})`,
    data.criticalStagnant.length > 0
      ? `<table style="width:100%;border-collapse:collapse">${data.criticalStagnant.map((l) => leadRow(l, `${l.agentName || 'nealocat'} · ${l.hoursLabel}`)).join('')}</table>`
      : emptyNote('Niciun lead critic — bravo echipei!'),
    '#dc2626'
  ))

  if (data.agentRows.length > 0) {
    parts.push(section(
      'Pe agenți',
      `<table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:4px 0;font-size:11px;color:#94a3b8;text-transform:uppercase">Agent</td>
          <td style="padding:4px 0;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase">Activ</td>
          <td style="padding:4px 0 4px 12px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase">Critic</td>
          <td style="padding:4px 0 4px 12px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase">Noi</td>
        </tr>
        ${data.agentRows.map((a) => `<tr>
          <td style="padding:6px 0;font-size:13px;color:#0f172a">${a.agentName}</td>
          <td style="padding:6px 0;text-align:right;font-size:13px;color:#0f172a">${a.activeCount}</td>
          <td style="padding:6px 0 6px 12px;text-align:right;font-size:13px;color:${a.criticalCount > 0 ? '#dc2626' : '#0f172a'}">${a.criticalCount}</td>
          <td style="padding:6px 0 6px 12px;text-align:right;font-size:13px;color:#0f172a">${a.newCount}</td>
        </tr>`).join('')}
      </table>`
    ))
  }

  return parts.join('')
}

function teamDigestText(data: TeamDigestData): string {
  return [
    `Digest zilnic JinfoTours CRM — echipă`,
    ``,
    `Leaduri noi: ${data.newLeadsCount} (${data.unassignedCount} nealocate)`,
    `Active: ${data.activeCount}`,
    `Critice (>96h): ${data.criticalStagnant.length}`,
    `Finalizate ieri: ${data.wonLast24hCount} câștigate (${formatEur(data.wonLast24hValueEur)}), ${data.lostLast24hCount} fără succes`,
  ].join('\n')
}

export function buildTeamDigestEmail(data: TeamDigestData, personalSection?: { agentName: string; data: AgentDigestData }): DigestEmail {
  const personalHtml = personalSection
    ? `<p style="margin:0 0 20px;font-size:14px;color:#0f172a">Bună, ${personalSection.agentName}. Mai jos, leadurile tale, apoi imaginea de ansamblu a echipei:</p>${agentSectionsHtml(personalSection.data)}<div style="margin:0 0 20px;border-top:1px dashed #cbd5e1"></div>`
    : ''

  return {
    subject: `Digest zilnic echipă — ${data.newLeadsCount} leaduri noi, ${data.criticalStagnant.length} critice`,
    html: shell(
      `${data.newLeadsCount} leaduri noi, ${data.activeCount} active, ${data.criticalStagnant.length} critice`,
      `${personalHtml}${teamSectionHtml(data)}`
    ),
    text: (personalSection ? agentDigestText(personalSection.agentName, personalSection.data) + '\n\n' : '') + teamDigestText(data),
  }
}
