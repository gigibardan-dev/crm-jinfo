'use client'

/**
 * src/components/reports/TrendAreaChart.tsx
 *
 * TrendAreaChart
 *
 * Grafic de arie/linie, serie unică (evoluție leaduri în timp) — vezi
 * skill-ul dataviz: linie 2px, arie ~10% opacitate, crosshair + tooltip la
 * hover, fără legendă (o singură serie, titlul cardului spune ce e).
 * SVG cu `vector-effect="non-scaling-stroke"` pt. linie (viewBox non-pătrat,
 * ca stroke-ul să nu se deformeze), punctul de hover și tooltip-ul randate
 * ca overlay HTML absolut poziționat (evită elipsa unui cerc SVG sub scalare
 * neuniformă x/y).
 */

import { useState, useRef } from 'react'

interface TrendPointInput {
  label: string
  value: number
}

interface TrendAreaChartProps {
  points: TrendPointInput[]
  height?: number
  valueFormatter?: (value: number) => string
}

const VIEW_WIDTH = 600
const PAD = { top: 8, right: 4, bottom: 8, left: 4 }

export function TrendAreaChart({ points, height = 180, valueFormatter = (v) => String(v) }: TrendAreaChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (points.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 py-4">Fără date în intervalul selectat.</p>
  }

  const maxVal = Math.max(...points.map((p) => p.value), 0)
  const niceMax = maxVal <= 5 ? maxVal + 1 : Math.ceil(maxVal * 1.15)
  const plotHeight = height - PAD.top - PAD.bottom
  const plotWidth = VIEW_WIDTH - PAD.left - PAD.right
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0

  const coords = points.map((p, i) => ({
    x: PAD.left + stepX * i,
    y: PAD.top + plotHeight - (niceMax > 0 ? (p.value / niceMax) * plotHeight : 0),
    ...p,
  }))

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ')
  const baseline = PAD.top + plotHeight
  const areaPath = points.length > 1
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${baseline} L ${coords[0].x.toFixed(2)} ${baseline} Z`
    : ''

  const gridFractions = [0, 0.5, 1]

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * VIEW_WIDTH
    let closest = 0
    let closestDist = Infinity
    coords.forEach((c, i) => {
      const dist = Math.abs(c.x - relX)
      if (dist < closestDist) { closestDist = dist; closest = i }
    })
    setHoverIdx(closest)
  }

  const hover = hoverIdx !== null ? coords[hoverIdx] : null
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {gridFractions.map((f) => {
          const y = PAD.top + plotHeight - f * plotHeight
          return <line key={f} x1={PAD.left} x2={VIEW_WIDTH - PAD.right} y1={y} y2={y} stroke="var(--rpt-grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        })}
        {areaPath && <path d={areaPath} fill="var(--rpt-series-wash)" stroke="none" />}
        <path d={linePath} fill="none" stroke="var(--rpt-series)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hover && (
          <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={baseline} stroke="var(--rpt-baseline)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      {/* Punctul de hover — div HTML, nu cerc SVG (viewBox nu e pătrat, un
          cerc SVG s-ar deforma în elipsă sub scalarea x/y neuniformă). */}
      {hover && (
        <div
          className="absolute w-2 h-2 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(hover.x / VIEW_WIDTH) * 100}%`,
            top: `${(hover.y / height) * 100}%`,
            backgroundColor: 'var(--rpt-series)',
            boxShadow: '0 0 0 2px var(--rpt-surface)',
          }}
        />
      )}

      {/* Etichete X — subset, ca să nu se aglomereze */}
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1 mt-1">
        {coords.map((c, i) => (
          <span key={i} className={i % labelEvery === 0 || i === coords.length - 1 ? '' : 'invisible'}>
            {c.label}
          </span>
        ))}
      </div>

      {hover && (
        <div
          className="absolute pointer-events-none bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg px-2 py-1 shadow-lg -translate-x-1/2"
          style={{
            left: `${(hover.x / VIEW_WIDTH) * 100}%`,
            top: `${Math.max((hover.y / height) * 100 - 14, 0)}%`,
          }}
        >
          <div className="font-medium tabular-nums">{valueFormatter(hover.value)}</div>
          <div className="text-[10px] opacity-70">{hover.label}</div>
        </div>
      )}
    </div>
  )
}
