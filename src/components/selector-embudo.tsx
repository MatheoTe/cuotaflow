import Link from 'next/link'
import { HandCoins, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Embudo = 'originacion' | 'cobranzas'

const EMBUDOS: Array<{ id: Embudo; label: string; linea: string; icon: typeof TrendingUp }> = [
  { id: 'originacion', label: 'Originación', linea: 'Línea comercial', icon: TrendingUp },
  { id: 'cobranzas', label: 'Cobranzas', linea: 'Línea de cobranzas', icon: HandCoins },
]

/** Cada embudo tiene su propia línea de WhatsApp: lo que entra por una no cae en el otro. */
export function SelectorEmbudo({ actual }: { actual: Embudo }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="glass flex gap-1 rounded-2xl p-1">
        {EMBUDOS.map(({ id, label, linea, icon: Icon }) => {
          const activo = id === actual
          return (
            <Link
              key={id}
              href={id === 'originacion' ? '/tablero' : `/tablero?embudo=${id}`}
              className={cn('flex items-center gap-2.5 rounded-xl px-4 py-2 transition-all', activo ? 'bg-primary/15 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]' : 'hover:bg-white/5')}
            >
              <Icon className={cn('h-4 w-4', activo ? 'text-primary' : 'text-on-surface-variant')} />
              <span className="flex flex-col leading-tight">
                <span className={cn('text-body-sm font-semibold', activo ? 'text-on-surface' : 'text-on-surface-variant')}>{label}</span>
                <span className="text-label-sm text-on-surface-variant">{linea}</span>
              </span>
            </Link>
          )
        })}
      </div>
      <span className="ml-auto rounded-full border border-dashed border-white/15 px-3 py-1.5 text-label-md text-on-surface-variant">+ Nuevo embudo</span>
    </div>
  )
}
