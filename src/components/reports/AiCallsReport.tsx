/**
 * src/components/reports/AiCallsReport.tsx
 *
 * Rapoarte → tab „Apeluri AI" (admin/manager).
 *
 * Filtre: interval (după data apelului), campanie / agent AI, listă de apelare.
 * Secțiuni:
 *   1. KPI-uri: apeluri efectuate, rată de răspuns, leaduri calificate,
 *      fierbinți, durată medie, cost total + cost per lead fierbinte,
 *      leaduri câștigate + valoare, câți au sunat înapoi + coada curentă.
 *      Apelurile primite (direction = 'inbound') nu intră în ratele apelurilor
 *      ieșite — apar separat și în tabel (marcate „A sunat înapoi").
 *   2. „De sunat urgent" — leaduri Fierbinte/Interesat după ultimul apel AI,
 *      la care niciun agent n-a făcut nimic de atunci (cel mai mare risc:
 *      leadul încălzit de AI se răcește dacă nu e sunat repede).
 *   3. Pâlnia pe leaduri unice: sunați → au răspuns → calificați →
 *      fierbinți → câștigați.
 *   4. Distribuția rezultatelor + cum s-au încheiat apelurile (pentru
 *      reglarea asistentului — ex. câte închide singur asistentul).
 *   5. Performanță pe campanie (compară prompturile între ele).
 *   6. Alte destinații cerute de clienți.
 *   7. Toate apelurile: tabel paginat, filtru pe rezultat, înregistrare
 *      redată direct în tabel, link spre lead (conversația completă), CSV.
 *
 * Agregările sunt funcții pure în src/lib/utils/aiCallsReport.ts. Cât timp
 * există apeluri în coadă / în desfășurare, datele se reîncarcă la 30s.
 */

'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, subDays } from 'date-fns'
import {
  PhoneCall, PhoneIncoming, PhoneForwarded, Flame, Timer, Wallet, Trophy, Download, Play, Square, AlertTriangle, ExternalLink, Bot,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatTile } from '@/components/reports/StatTile'
import { HBarChart } from '@/components/reports/HBarChart'
import { Pagination } from '@/components/ui/Pagination'
import { AiCallStatusBadge } from '@/components/leads/AiCallStatusBadge'
import { AI_CALL_STATUS_LABELS, ENDED_REASON_LABELS } from '@/lib/voice/classify'
import type { AiCallStatus } from '@/lib/types/database'
import { formatPercent, formatEur, downloadCSV } from '@/lib/utils/reports'
import { fullName, formatDateTime } from '@/lib/utils'
import {
  type ReportCall, isListed, computeAiCallKPIs, computeAiFunnel, computeResultDistribution, computeEndedReasons,
  computeCampaignPerformance, computeOtherDestinations, computeUrgentFollowUps, formatUsd, formatCallDuration, aiCallsToCSV,
} from '@/lib/utils/aiCallsReport'

const CALL_COLUMNS =
  'id, created_at, ended_at, lead_id, direction, campaign_id, list_id, status, result, ended_reason, duration_sec, cost, summary, recording_url, structured_data, call_campaigns(name), leads!ai_calls_lead_id_fkey(first_name, last_name, phone, status, won_value, assigned_to, last_interaction_at)'

const PAGE = 1000

const selectClass =
  'px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
const dateInputClass =
  'flex-1 sm:flex-none px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
const cardClass = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5'

const RESULT_COLORS: Partial<Record<AiCallStatus, string>> = {
  hot: 'var(--rpt-good)',
  interested: 'var(--rpt-series)',
  other_request: 'var(--rpt-ordinal-3)',
  callback: 'var(--rpt-ordinal-2)',
}

function formatHoursAgo(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  if (h < 48) return `${Math.round(h)} h`
  return `${Math.round(h / 24)} zile`
}

export function AiCallsReport() {
  const supabase = createClient()

  const [calls, setCalls] = useState<ReportCall[]>([])
  const [loading, setLoading] = useState(true)
  const [queueNow, setQueueNow] = useState(0)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [lists, setLists] = useState<{ id: string; name: string }[]>([])
  const [agentNameById, setAgentNameById] = useState<Map<string, string>>(new Map())

  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [filterCampaign, setFilterCampaign] = useState('all')
  const [filterList, setFilterList] = useState('all')

  // Tabelul de apeluri
  const [filterResult, setFilterResult] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [playingId, setPlayingId] = useState<string | null>(null)

  // --- Lookup-uri (o singură dată) ---
  useEffect(() => {
    Promise.all([
      supabase.from('call_campaigns').select('id, name').order('created_at', { ascending: false }),
      supabase.from('call_lists').select('id, name').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name'),
    ]).then(([c, l, p]) => {
      setCampaigns(c.data || [])
      setLists(l.data || [])
      setAgentNameById(new Map((p.data || []).map((x) => [x.id, x.full_name])))
    })
  }, [supabase])

  // --- Apelurile din interval (paginat, PostgREST întoarce max 1000/cerere) ---
  const fetchCalls = useCallback(async () => {
    const all: ReportCall[] = []
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('ai_calls')
        .select(CALL_COLUMNS)
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (filterCampaign !== 'all') q = q.eq('campaign_id', filterCampaign)
      if (filterList !== 'all') q = q.eq('list_id', filterList)
      const { data } = await q
      all.push(...((data || []) as unknown as ReportCall[]))
      if (!data || data.length < PAGE) break
    }
    const { count } = await supabase
      .from('ai_calls')
      .select('id', { count: 'exact', head: true })
      .in('status', ['queued', 'ringing', 'in_progress'])
    return { all, queue: count || 0 }
  }, [supabase, dateFrom, dateTo, filterCampaign, filterList])

  const apply = useCallback((r: { all: ReportCall[]; queue: number }) => {
    setCalls(r.all)
    setQueueNow(r.queue)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCalls().then(apply)
  }, [fetchCalls, apply])

  // Reîncărcare la 30s cât timp coada lucrează
  useEffect(() => {
    if (queueNow === 0) return
    // GET /api/voice/calls rulează și dispecerul (reconciliere + următoarele apeluri)
    const t = setInterval(() => {
      fetch('/api/voice/calls').catch(() => {}).finally(() => fetchCalls().then(apply))
    }, 30_000)
    return () => clearInterval(t)
  }, [queueNow, fetchCalls, apply])

  // --- Agregări ---
  const kpis = useMemo(() => computeAiCallKPIs(calls), [calls])
  const funnel = useMemo(() => computeAiFunnel(calls), [calls])
  const results = useMemo(() => computeResultDistribution(calls), [calls])
  const endedReasons = useMemo(() => computeEndedReasons(calls), [calls])
  const campaignPerf = useMemo(() => computeCampaignPerformance(calls), [calls])
  const otherDest = useMemo(() => computeOtherDestinations(calls), [calls])
  const urgent = useMemo(() => computeUrgentFollowUps(calls), [calls])

  const tableCalls = useMemo(
    () => calls.filter(isListed).filter((c) => filterResult === 'all' || c.result === filterResult),
    [calls, filterResult]
  )
  const pageCalls = useMemo(() => tableCalls.slice((page - 1) * perPage, page * perPage), [tableCalls, page, perPage])

  function exportCSV() {
    downloadCSV(`apeluri-ai_${dateFrom}_${dateTo}.csv`, aiCallsToCSV(calls, agentNameById))
  }

  const funnelMax = funnel[0]?.value || 0

  return (
    <div className="space-y-4">
      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
        <select value={filterCampaign} onChange={(e) => { setFilterCampaign(e.target.value); setPage(1) }} className={selectClass}>
          <option value="all">Toate campaniile AI</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {lists.length > 0 && (
          <select value={filterList} onChange={(e) => { setFilterList(e.target.value); setPage(1) }} className={selectClass}>
            <option value="all">Orice listă de apelare</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0">De la</span>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className={dateInputClass} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0">până la</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className={dateInputClass} />
          </div>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          disabled={loading || kpis.placed === 0}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* KPI-uri */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Apeluri efectuate" value={String(kpis.placed)} sub={`${kpis.uniqueLeads} leaduri unice`} icon={PhoneCall} />
        <StatTile label="Rată de răspuns" value={formatPercent(kpis.answerRate)} sub={`${kpis.answered} au răspuns`} icon={PhoneIncoming} />
        <StatTile
          label="Leaduri calificate"
          value={String(kpis.qualifiedLeads)}
          sub={`${formatPercent(kpis.qualifiedRate)} din cei care au răspuns`}
          icon={Bot}
          tone={kpis.qualifiedLeads > 0 ? 'good' : 'default'}
        />
        <StatTile label="Fierbinți" value={String(kpis.hotLeads)} sub="vor să rezerve" icon={Flame} tone={kpis.hotLeads > 0 ? 'good' : 'default'} />
        <StatTile label="Durată medie discuție" value={formatCallDuration(kpis.avgDurationSec === null ? null : Math.round(kpis.avgDurationSec))} icon={Timer} />
        <StatTile label="Cost total" value={formatUsd(kpis.totalCostUsd)} sub={`${formatUsd(kpis.costPerHotUsd)} / lead fierbinte`} icon={Wallet} />
        <StatTile label="Câștigați după apel" value={String(kpis.wonLeads)} sub={formatEur(kpis.wonValueEur)} icon={Trophy} tone={kpis.wonLeads > 0 ? 'good' : 'default'} />
        <StatTile label="Au sunat înapoi" value={String(kpis.callbacks)} sub={`În coadă / în apel acum: ${queueNow}`} icon={PhoneForwarded} tone={kpis.callbacks > 0 ? 'good' : 'default'} />
      </div>

      {/* De sunat urgent */}
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <AlertTriangle size={15} className={urgent.length ? 'text-red-500' : 'text-slate-400'} />
            De sunat urgent ({urgent.length})
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Fierbinți sau interesați după apelul AI, la care niciun agent n-a adăugat comentariu sau n-a schimbat statusul de atunci.
        </p>
        {urgent.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nimic restant — toate leadurile calificate au fost preluate de agenți.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2 pr-2 font-medium">Client</th>
                  <th className="py-2 px-2 font-medium">Rezultat</th>
                  <th className="py-2 px-2 font-medium">Campanie</th>
                  <th className="py-2 px-2 font-medium">Agent</th>
                  <th className="py-2 pl-2 font-medium text-right">De la apel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {urgent.map(({ call, hoursSinceCall }) => (
                  <tr key={call.id} className="text-slate-700 dark:text-slate-300">
                    <td className="py-2 pr-2">
                      <Link href={`/leads/${call.lead_id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                        {fullName(call.leads?.first_name ?? null, call.leads?.last_name ?? null)}
                      </Link>
                      {call.summary && <p className="text-xs text-slate-400 line-clamp-1 max-w-md">{call.summary}</p>}
                    </td>
                    <td className="py-2 px-2"><AiCallStatusBadge status={call.result} /></td>
                    <td className="py-2 px-2 text-xs truncate max-w-[12rem]">{call.call_campaigns?.name || '—'}</td>
                    <td className="py-2 px-2 text-xs">
                      {call.leads?.assigned_to ? agentNameById.get(call.leads.assigned_to) || '—' : <span className="text-red-600 dark:text-red-400">Nealocat</span>}
                    </td>
                    <td className={`py-2 pl-2 text-right text-xs tabular-nums ${hoursSinceCall >= 24 ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                      {formatHoursAgo(hoursSinceCall)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pâlnie + rezultate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Pâlnia apelurilor AI (leaduri unice)</h3>
          {funnelMax === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-4">Niciun apel în intervalul selectat.</p>
          ) : (
            <div className="space-y-3">
              {funnel.map((step, i) => {
                const pct = funnelMax ? step.value / funnelMax : 0
                const prev = i > 0 ? funnel[i - 1].value : null
                return (
                  <div key={step.key}>
                    <div className="flex items-baseline justify-between gap-2 mb-1 text-xs">
                      <span className="text-slate-600 dark:text-slate-300">{step.label}</span>
                      <span className="tabular-nums text-slate-900 dark:text-slate-100 font-medium">
                        {step.value}
                        {prev ? <span className="ml-1.5 font-normal text-slate-400">({formatPercent(step.value / prev)} din pasul anterior)</span> : null}
                      </span>
                    </div>
                    <div className="h-2.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.max(pct * 100, step.value ? 2 : 0)}%`, backgroundColor: step.key === 'won' ? 'var(--rpt-good)' : 'var(--rpt-series)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className={cardClass}>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Rezultatul apelurilor</h3>
          <HBarChart
            data={results.map((r) => ({ key: r.key, label: r.label, value: r.value, color: RESULT_COLORS[r.key] || 'var(--rpt-baseline)' }))}
            emptyMessage="Niciun apel încheiat în intervalul selectat."
          />
        </div>
      </div>

      {/* Închideri + alte destinații */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Cum s-au încheiat apelurile</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Util pentru reglarea asistentului — ideal, „Asistentul a închis” după fiecare discuție completă.</p>
          <HBarChart data={endedReasons} emptyMessage="Niciun apel în intervalul selectat." />
        </div>
        <div className={cardClass}>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Alte destinații cerute</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Ce au mai cerut clienții în afară de oferta sunată — idei pentru campaniile următoare.</p>
          <HBarChart data={otherDest} emptyMessage="Nicio altă destinație cerută în intervalul selectat." />
        </div>
      </div>

      {/* Pe campanie */}
      <div className={cardClass}>
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Performanță pe campanie (agent AI)</h3>
        {campaignPerf.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Niciun apel în intervalul selectat.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-1.5 pr-2 font-medium">Campanie</th>
                  <th className="py-1.5 px-2 font-medium text-right">Apeluri</th>
                  <th className="py-1.5 px-2 font-medium text-right">Răspuns</th>
                  <th className="py-1.5 px-2 font-medium text-right">Calificați</th>
                  <th className="py-1.5 px-2 font-medium text-right">Fierbinți</th>
                  <th className="py-1.5 px-2 font-medium text-right">Câștigați</th>
                  <th className="py-1.5 px-2 font-medium text-right">Vânzări</th>
                  <th className="py-1.5 px-2 font-medium text-right">Cost</th>
                  <th className="py-1.5 pl-2 font-medium text-right">Cost / fierbinte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {campaignPerf.map((c) => (
                  <tr key={c.campaignId} className="text-slate-700 dark:text-slate-300">
                    <td className="py-1.5 pr-2 truncate max-w-[14rem]">{c.name}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{c.placed}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatPercent(c.answerRate)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{c.qualified}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{c.hot}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{c.won}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatEur(c.wonValueEur)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatUsd(c.costUsd)}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">{formatUsd(c.costPerHotUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toate apelurile */}
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Toate apelurile ({tableCalls.length})</h3>
          <select value={filterResult} onChange={(e) => { setFilterResult(e.target.value); setPage(1) }} className={selectClass}>
            <option value="all">Orice rezultat</option>
            {(Object.keys(AI_CALL_STATUS_LABELS) as AiCallStatus[])
              .filter((k) => k !== 'queued' && k !== 'in_progress')
              .map((k) => <option key={k} value={k}>{AI_CALL_STATUS_LABELS[k]}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="animate-pulse h-24 bg-slate-50 dark:bg-slate-800 rounded-lg" />
        ) : tableCalls.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Niciun apel pentru filtrele selectate.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2 pr-2 font-medium w-8" />
                    <th className="py-2 px-2 font-medium">Data</th>
                    <th className="py-2 px-2 font-medium">Client</th>
                    <th className="py-2 px-2 font-medium">Rezultat</th>
                    <th className="py-2 px-2 font-medium">Rezumat</th>
                    <th className="py-2 px-2 font-medium text-right">Durată</th>
                    <th className="py-2 px-2 font-medium text-right">Cost</th>
                    <th className="py-2 pl-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {pageCalls.map((c) => {
                    const playing = playingId === c.id
                    return (
                      <Fragment key={c.id}>
                        <tr className="text-slate-700 dark:text-slate-300 align-top">
                          <td className="py-2 pr-2">
                            {c.recording_url && (
                              <button
                                type="button"
                                onClick={() => setPlayingId(playing ? null : c.id)}
                                className={`p-1.5 rounded-lg transition-colors ${playing ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300' : 'text-slate-400 hover:text-violet-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                aria-label={playing ? 'Oprește înregistrarea' : 'Ascultă înregistrarea'}
                              >
                                {playing ? <Square size={13} /> : <Play size={13} />}
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-2 text-xs whitespace-nowrap">{formatDateTime(c.created_at)}</td>
                          <td className="py-2 px-2">
                            <Link href={`/leads/${c.lead_id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                              {fullName(c.leads?.first_name ?? null, c.leads?.last_name ?? null)}
                            </Link>
                            <p className="text-xs text-slate-400 truncate max-w-[12rem]">
                              {c.direction === 'inbound' && <span className="text-emerald-600 dark:text-emerald-400 font-medium">A sunat înapoi · </span>}
                              {c.call_campaigns?.name || '—'}
                            </p>
                          </td>
                          <td className="py-2 px-2">
                            <AiCallStatusBadge status={c.result} />
                            {c.ended_reason && (
                              <p className="text-[11px] text-slate-400 mt-1">{ENDED_REASON_LABELS[c.ended_reason] || c.ended_reason}</p>
                            )}
                          </td>
                          <td className="py-2 px-2 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                            <p className="line-clamp-2">{c.summary || '—'}</p>
                          </td>
                          <td className="py-2 px-2 text-right text-xs tabular-nums whitespace-nowrap">{formatCallDuration(c.duration_sec)}</td>
                          <td className="py-2 px-2 text-right text-xs tabular-nums whitespace-nowrap">{c.cost !== null ? formatUsd(Number(c.cost)) : '—'}</td>
                          <td className="py-2 pl-2">
                            <Link
                              href={`/leads/${c.lead_id}`}
                              className="inline-flex p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label="Deschide leadul cu conversația completă"
                              title="Conversația completă"
                            >
                              <ExternalLink size={13} />
                            </Link>
                          </td>
                        </tr>
                        {playing && (
                          <tr>
                            <td colSpan={8} className="pb-3">
                              <audio controls autoPlay src={`/api/voice/recording/${c.id}`} className="w-full h-10" />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalItems={tableCalls.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
            />
          </>
        )}
      </div>
    </div>
  )
}
