'use client'

/**
 * src/app/(app)/reports/page.tsx
 *
 * Reports Page — Faza 1
 *
 * Prima felie funcțională din secțiunea de rapoarte (vezi
 * claude/rapoarte-plan.md în proiectul Claude pt. viziunea completă și
 * fazele următoare). Admin/manager only (ca și restul paginii, gate
 * existent păstrat).
 *
 * Conține, toate recalculate din același set de lead-uri filtrat (interval
 * de date + agent opțional — vezi ReportsFilterBar):
 * - KPI-uri sumar (leaduri noi, rată conversie, valoare câștigată, timp
 *   mediu până la primul răspuns, nealocate curent, stagnante curent)
 * - Evoluție leaduri în timp (arie, granularitate automată zi/săpt/lună)
 * - Distribuție curentă pe etape de pipeline (bar chart, rampă ordinală)
 * - Performanță per agent (bar chart + tabel detaliat)
 * - Performanță per sursă (bar chart + tabel detaliat)
 * - Motive „Fără Succes” (bar chart)
 * - Export CSV al lead-urilor din selecția curentă
 *
 * Toate agregările sunt funcții pure din src/lib/utils/reports.ts, rulate
 * client-side pe rezultatul unui singur query paginat pe interval (+ agent
 * opțional) — nu există încă un RPC/view de agregare server-side; la volum
 * mult mai mare, asta ar fi următorul pas (vezi doc-ul din proiect).
 *
 * Notă: „Nealocate" și „Stagnante" din rândul de KPI sunt instantanee
 * curente (ca și cardurile din Dashboard), NU filtrate de intervalul de
 * date ales — un lead nealocat rămâne relevant azi indiferent când a fost
 * creat.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { StatTile } from '@/components/reports/StatTile'
import { HBarChart } from '@/components/reports/HBarChart'
import { TrendAreaChart } from '@/components/reports/TrendAreaChart'
import { ReportsFilterBar } from '@/components/reports/ReportsFilterBar'
import { TERMINAL_STATUSES } from '@/lib/utils/constants'
import { stagnantThresholdIso } from '@/lib/utils/stagnantLeads'
import {
  computeKPIs, computeTrend, computeFunnel, computeAgentPerformance, computeSourcePerformance, computeLostReasons,
  formatPercent, formatEur, formatHoursDuration, leadsToCSV, downloadCSV,
  type ReportLead,
} from '@/lib/utils/reports'
import type { Profile, LeadSource, PipelineStage } from '@/lib/types/database'
import { Users2, TrendingUp, Wallet, Timer, Inbox, AlertTriangle, BarChart3 } from 'lucide-react'
import { format, subDays } from 'date-fns'

const REPORT_LEAD_COLUMNS = 'id, first_name, last_name, email, phone, status, priority, source, destination, assigned_to, created_at, first_response_at, won_value, total_amount_ron, commission_eur, commission_ron, lost_reason'

const ORDINAL_RAMP = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => `var(--rpt-ordinal-${n})`)

export default function ReportsPage() {
  const { isAdminOrManager } = useAuth()
  const supabase = createClient()

  const [agents, setAgents] = useState<Profile[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<ReportLead[]>([])
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [stagnantCount, setStagnantCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [filterAgent, setFilterAgent] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [filterDateTo, setFilterDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))

  // --- Lookup-uri (agenți/surse/etape) — o singură dată, nu depind de filtre ---
  useEffect(() => {
    if (!isAdminOrManager) return
    async function fetchLookups() {
      const [profilesRes, sourcesRes, stagesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('lead_sources').select('*').order('name'),
        supabase.from('pipeline_stages').select('*').order('display_order'),
      ])
      setAgents(profilesRes.data || [])
      setSources(sourcesRes.data || [])
      setStages(stagesRes.data || [])
    }
    fetchLookups()
  }, [supabase, isAdminOrManager])

  // --- Lead-uri filtrate de interval + agent opțional ---
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('leads')
      .select(REPORT_LEAD_COLUMNS)
      .gte('created_at', `${filterDateFrom}T00:00:00`)
      .lte('created_at', `${filterDateTo}T23:59:59`)

    if (filterAgent !== 'all') query = query.eq('assigned_to', filterAgent)

    const { data } = await query
    setLeads(data || [])
    setLoading(false)
  }, [supabase, filterDateFrom, filterDateTo, filterAgent])

  // --- Instantanee curente (nu depind de interval) ---
  const fetchSnapshots = useCallback(async () => {
    const [unassignedRes, stagnantRes] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .lt('last_interaction_at', stagnantThresholdIso())
        .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`),
    ])
    setUnassignedCount(unassignedRes.count || 0)
    setStagnantCount(stagnantRes.count || 0)
  }, [supabase])

  useEffect(() => {
    if (!isAdminOrManager) return
    fetchLeads()
  }, [isAdminOrManager, fetchLeads])

  useEffect(() => {
    if (!isAdminOrManager) return
    fetchSnapshots()

    const channel = supabase
      .channel('reports-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
        fetchSnapshots()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isAdminOrManager, supabase, fetchSnapshots, fetchLeads])

  // --- Shortcut „Lună întreagă" — scrie direct în filterDateFrom/To, la fel ca în Pipeline ---
  function applyMonthYear(month: string, year: string) {
    if (!month) return
    const y = Number(year)
    const m = Number(month)
    const first = new Date(y, m - 1, 1)
    const last = new Date(y, m, 0)
    setFilterDateFrom(format(first, 'yyyy-MM-dd'))
    setFilterDateTo(format(last, 'yyyy-MM-dd'))
  }
  function handleMonthChange(value: string) {
    setFilterMonth(value)
    applyMonthYear(value, filterYear)
  }
  function handleYearChange(value: string) {
    setFilterYear(value)
    if (filterMonth) applyMonthYear(filterMonth, value)
  }
  function handleDateFromChange(value: string) {
    setFilterDateFrom(value)
    setFilterMonth('')
  }
  function handleDateToChange(value: string) {
    setFilterDateTo(value)
    setFilterMonth('')
  }

  // --- Agregări (pure, din src/lib/utils/reports.ts) ---
  const kpis = useMemo(() => computeKPIs(leads, unassignedCount), [leads, unassignedCount])
  const trend = useMemo(() => computeTrend(leads, new Date(`${filterDateFrom}T00:00:00`), new Date(`${filterDateTo}T00:00:00`)), [leads, filterDateFrom, filterDateTo])
  const funnel = useMemo(() => computeFunnel(leads, stages), [leads, stages])
  const agentPerf = useMemo(() => computeAgentPerformance(leads, agents), [leads, agents])
  const sourcePerf = useMemo(() => computeSourcePerformance(leads, sources), [leads, sources])
  const lostReasons = useMemo(() => computeLostReasons(leads), [leads])

  function handleExportCSV() {
    const csv = leadsToCSV(leads, agents, sources)
    downloadCSV(`rapoarte-jinfotours_${filterDateFrom}_${filterDateTo}.csv`, csv)
  }

  if (!isAdminOrManager) {
    return (
      <>
        <Header title="Rapoarte" />
        <div className="p-4 sm:p-6 text-sm text-slate-500 dark:text-slate-400">Nu ai acces la această pagină.</div>
      </>
    )
  }

  return (
    <>
      <Header title="Rapoarte" />
      <div className="p-4 sm:p-6 space-y-4">
        <ReportsFilterBar
          agents={agents}
          filterAgent={filterAgent}
          onFilterAgentChange={setFilterAgent}
          filterDateFrom={filterDateFrom}
          onFilterDateFromChange={handleDateFromChange}
          filterDateTo={filterDateTo}
          onFilterDateToChange={handleDateToChange}
          filterMonth={filterMonth}
          onFilterMonthChange={handleMonthChange}
          filterYear={filterYear}
          onFilterYearChange={handleYearChange}
          onExportCSV={handleExportCSV}
          exportDisabled={loading || leads.length === 0}
        />

        {/* KPI-uri */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatTile label="Leaduri în interval" value={String(kpis.totalLeads)} icon={Inbox} />
          <StatTile label="Rată conversie" value={formatPercent(kpis.conversionRate)} sub={`${kpis.wonCount} câștigate din ${kpis.wonCount + kpis.lostCount} închise`} icon={TrendingUp} tone={kpis.conversionRate !== null && kpis.conversionRate >= 0.3 ? 'good' : 'default'} />
          <StatTile label="Valoare câștigată" value={formatEur(kpis.wonValueEur)} icon={Wallet} tone="good" />
          <StatTile label="Timp mediu răspuns" value={formatHoursDuration(kpis.avgFirstResponseHours)} icon={Timer} />
          <StatTile label="Nealocate acum" value={String(kpis.unassignedCount)} icon={Users2} tone={kpis.unassignedCount > 0 ? 'critical' : 'default'} />
          <StatTile label="Stagnante acum" value={String(stagnantCount)} icon={AlertTriangle} tone={stagnantCount > 0 ? 'critical' : 'default'} />
        </div>

        {/* Evoluție în timp */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Evoluție Leaduri Noi</h3>
          <TrendAreaChart points={trend.map((t) => ({ label: t.label, value: t.count }))} />
        </div>

        {/* Pipeline + Motive „Fără Succes” */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Distribuție pe Etape de Pipeline</h3>
            <HBarChart
              data={funnel.map((f, i) => ({ key: f.slug, label: f.name, value: f.count, color: ORDINAL_RAMP[i % ORDINAL_RAMP.length] }))}
            />
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Motive „Fără Succes”</h3>
            <HBarChart
              data={lostReasons.map((r) => ({ key: r.reason, label: r.reason, value: r.count }))}
              emptyMessage="Niciun lead fără succes în intervalul selectat."
            />
          </div>
        </div>

        {/* Performanță agent + sursă */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Performanță pe Agent</h3>
            <HBarChart
              data={agentPerf.slice(0, 8).map((a) => ({ key: a.agentId, label: a.agentName, value: a.wonValueEur }))}
              valueFormatter={formatEur}
              emptyMessage="Niciun lead alocat în intervalul selectat."
            />
            {agentPerf.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-1.5 pr-2 font-medium">Agent</th>
                      <th className="py-1.5 px-2 font-medium text-right">Alocate</th>
                      <th className="py-1.5 px-2 font-medium text-right">Câștigate</th>
                      <th className="py-1.5 px-2 font-medium text-right">Conversie</th>
                      <th className="py-1.5 pl-2 font-medium text-right">Răspuns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                    {agentPerf.map((a) => (
                      <tr key={a.agentId} className="text-slate-700 dark:text-slate-300">
                        <td className="py-1.5 pr-2 truncate max-w-[10rem]">{a.agentName}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{a.total}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{a.won}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{formatPercent(a.conversionRate)}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{formatHoursDuration(a.avgFirstResponseHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Performanță pe Sursă</h3>
            <HBarChart
              data={sourcePerf.map((s) => ({ key: s.sourceSlug, label: s.sourceName, value: s.total }))}
            />
            {sourcePerf.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-1.5 pr-2 font-medium">Sursă</th>
                      <th className="py-1.5 px-2 font-medium text-right">Leaduri</th>
                      <th className="py-1.5 px-2 font-medium text-right">Câștigate</th>
                      <th className="py-1.5 pl-2 font-medium text-right">Conversie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                    {sourcePerf.map((s) => (
                      <tr key={s.sourceSlug} className="text-slate-700 dark:text-slate-300">
                        <td className="py-1.5 pr-2 truncate max-w-[10rem]">{s.sourceName}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{s.total}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{s.won}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{formatPercent(s.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {leads.length === 0 && !loading && (
          <div className="flex items-center gap-2.5 text-sm text-slate-400 dark:text-slate-500 py-4">
            <BarChart3 size={16} className="shrink-0" />
            Niciun lead în intervalul și filtrele selectate.
          </div>
        )}
      </div>
    </>
  )
}
