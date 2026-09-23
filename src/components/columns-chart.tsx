'use client'

import { useState } from 'react'

export interface Serie { label: string; color: string; values: number[] }

/** Ticks enteros y redondos para conteos chicos. */
function ticks(max: number): number[] {
  const top = Math.max(2, max)
  const step = top <= 5 ? 1 : top <= 10 ? 2 : top <= 25 ? 5 : Math.ceil(top / 5 / 10) * 10
  const end = Math.ceil(top / step) * step
  const out: number[] = []
  for (let v = 0; v <= end; v += step) out.push(v)
  return out
}

/**
 * Columnas apiladas por día, con separación de 2px entre segmentos, punta
 * redondeada, grilla hairline, leyenda y tooltip al pasar el mouse.
 */
export function ColumnsChart({ series, labels, height = 220 }: { series: Serie[]; labels: string[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 720
  const padL = 32, padR = 12, padT = 12, padB = 26
  const n = labels.length
  const totales = labels.map((_, i) => series.reduce((a, s) => a + s.values[i], 0))
  const ys = ticks(Math.max(...totales))
  const top = ys[ys.length - 1]
  const slot = (width - padL - padR) / n
  const bw = Math.min(24, slot * 0.6)
  const px = (i: number) => padL + slot * i + (slot - bw) / 2
  const py = (v: number) => padT + (1 - v / top) * (height - padT - padB)
  const gap = 2

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-label-md text-on-surface-variant">
        {series.map(s => (
          <span key={s.label} className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img" aria-label={series.map(s => s.label).join(' y ')} onMouseLeave={() => setHover(null)}>
        {ys.map(v => (
          <g key={v}>
            <line x1={padL} x2={width - padR} y1={py(v)} y2={py(v)} stroke="hsl(220 30% 100% / 0.07)" strokeWidth={1} />
            <text x={padL - 8} y={py(v)} dy={4} textAnchor="end" fontSize={11} fill="hsl(222 16% 60%)">{v}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <g key={l + i}>
            {((i % Math.ceil(n / 7) === 0 && i < n - 2) || i === n - 1) && <text x={px(i) + bw / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="hsl(222 16% 60%)">{l}</text>}
            {/* zona de hover más grande que la columna */}
            <rect x={padL + slot * i} y={padT} width={slot} height={height - padT - padB} fill="transparent" onMouseEnter={() => setHover(i)} />
            {hover === i && <rect x={padL + slot * i} y={padT} width={slot} height={height - padT - padB} fill="hsl(220 30% 100% / 0.04)" pointerEvents="none" />}
            {(() => {
              let acc = 0
              return series.map((s, k) => {
                const v = s.values[i]
                if (v <= 0) return null
                const y1 = py(acc + v), y0 = py(acc)
                acc += v
                const esTope = series.slice(k + 1).every(t => t.values[i] <= 0)
                const h = Math.max(0, y0 - y1 - (k > 0 ? gap : 0))
                const y = y1
                const r = esTope ? Math.min(4, bw / 2) : 0
                return <path key={s.label} pointerEvents="none" d={`M${px(i)},${y + h} V${y + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${y + h} Z`} fill={s.color} />
              })
            })()}
          </g>
        ))}
        {hover != null && (
          <g transform={`translate(${Math.min(width - padR - 150, Math.max(padL, px(hover) - 60))}, ${padT})`} pointerEvents="none">
            <rect width={150} height={18 + 16 * series.length} rx={8} fill="hsl(226 16% 18%)" stroke="hsl(220 30% 100% / 0.1)" />
            <text x={10} y={14} fontSize={11} fill="hsl(222 16% 70%)">{labels[hover]}</text>
            {series.map((s, k) => (
              <g key={s.label} transform={`translate(10, ${28 + 16 * k})`}>
                <circle cx={4} cy={-3} r={3.5} fill={s.color} />
                <text x={14} y={0} fontSize={11} fill="hsl(220 30% 97%)">{s.label}: {s.values[hover]}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}
