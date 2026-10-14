/**
 * Gráficos en SVG puro, sin dependencias. Siguen las specs de marcas:
 * líneas de 2px, barras de hasta 24px con punta redondeada, áreas al 10%,
 * marcadores de r>=4 con anillo del color de la superficie, grilla hairline.
 * Los colores llegan por CSS var (hsl(var(--etapa-x))) o hex.
 */

const SURFACE = 'hsl(227 18% 13%)'

export function Sparkline({ values, color, width = 160, height = 44 }: { values: number[]; color: string; width?: number; height?: number }) {
  const n = values.length
  if (n < 2) return <svg width={width} height={height} />
  const max = Math.max(1, ...values)
  const px = (i: number) => 4 + (i / (n - 1)) * (width - 8)
  const py = (v: number) => height - 6 - (v / max) * (height - 12)
  const pts = values.map((v, i) => `${px(i)},${py(v)}`)
  const path = `M${pts.join(' L')}`
  const area = `${path} L${px(n - 1)},${height - 2} L${px(0)},${height - 2} Z`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" aria-hidden>
      <path d={area} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(n - 1)} cy={py(values[n - 1])} r={4} fill={color} stroke={SURFACE} strokeWidth={2} />
    </svg>
  )
}

export function Bars({ values, color, width = 160, height = 44 }: { values: number[]; color: string; width?: number; height?: number }) {
  const n = values.length
  const max = Math.max(1, ...values)
  const gap = 2
  const bw = Math.min(24, (width - gap * (n - 1)) / n)
  const total = bw * n + gap * (n - 1)
  const x0 = (width - total) / 2
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" aria-hidden>
      {values.map((v, i) => {
        const h = Math.max(v > 0 ? 3 : 1, (v / max) * (height - 4))
        const x = x0 + i * (bw + gap)
        const y = height - h
        const r = Math.min(4, bw / 2)
        return <path key={i} d={`M${x},${height} V${y + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${height} Z`} fill={color} opacity={v > 0 ? 1 : 0.25} />
      })}
    </svg>
  )
}

export interface DonutPart { label: string; value: number; color: string }

export function Donut({ parts, size = 168, thickness = 22, center }: { parts: DonutPart[]; size?: number; thickness?: number; center?: { value: string; label: string } }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const gapPx = 2
  // Offset acumulado de cada arco, calculado antes del render (sin mutar durante el map).
  const arcos = parts.filter(p => p.value > 0).reduce<Array<{ part: DonutPart; len: number; offset: number }>>((acc, part) => {
    const prev = acc[acc.length - 1]
    const offset = prev ? prev.offset + prev.len : 0
    return [...acc, { part, len: (part.value / Math.max(1, total)) * c, offset }]
  }, [])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" role="img" aria-label={parts.map(p => `${p.label}: ${p.value}`).join(', ')}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(220 30% 100% / 0.05)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {arcos.map(({ part: p, len, offset }) => {
          const dash = Math.max(0, len - gapPx)
          return <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={thickness} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset - gapPx / 2} />
        })}
      </g>
      {center && (
        <>
          <text x="50%" y="48%" textAnchor="middle" fontSize={26} fontWeight={600} fill="hsl(220 30% 97%)" fontFamily="var(--font-display), var(--font-sans), sans-serif">{center.value}</text>
          <text x="50%" y="48%" dy={20} textAnchor="middle" fontSize={11} fill="hsl(222 16% 70%)" letterSpacing={1}>{center.label.toUpperCase()}</text>
        </>
      )}
    </svg>
  )
}

export function Meter({ value, max = 100, color, className = '' }: { value: number; max?: number; color: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${className}`} style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
