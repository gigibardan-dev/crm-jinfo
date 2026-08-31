'use client'

/**
 * src/components/reports/HBarChart.tsx
 *
 * HBarChart
 *
 * Bar chart orizontal, single-hue — pt. comparații de magnitudine (vezi
 * skill-ul dataviz, "choosing-a-form": magnitudine → o singură nuanță,
 * niciodată câte una per categorie). Fiecare bară pornește dintr-o
 * baseline comună, grosime fixă subțire, etichetă cu valoarea exactă la
 * capăt (label direct, niciodată doar culoare). Culoare per-bară opțională
 * (ex. rampa ordinală pt. funnel-ul de pipeline — vezi ReportsFunnel).
 * Rândul întreg poartă și un `title` cu eticheta + valoarea, ca tooltip
 * nativ minimal (hover layer simplu, fără crosshair — nu e nevoie pt. un
 * bar chart de comparație).
 *
 * Folosit pt.: distribuție pipeline, performanță agent, performanță sursă,
 * motive de pierdere.
 */

interface HBarDatum {
  key: string
  label: string
  value: number
  color?: string
  sub?: string
}

interface HBarChartProps {
  data: HBarDatum[]
  valueFormatter?: (value: number) => string
  emptyMessage?: string
}

export function HBarChart({ data, valueFormatter = (v) => String(v), emptyMessage = 'Fără date în intervalul selectat.' }: HBarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 py-4">{emptyMessage}</p>
  }

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = d.value > 0 ? Math.max((d.value / max) * 100, 2) : 0
        return (
          <div key={d.key} title={`${d.label}: ${valueFormatter(d.value)}`}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{d.label}</span>
              <span className="text-xs font-medium text-slate-900 dark:text-slate-100 shrink-0 tabular-nums">{valueFormatter(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: d.color || 'var(--rpt-series)' }}
              />
            </div>
            {d.sub && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{d.sub}</div>}
          </div>
        )
      })}
    </div>
  )
}
