import Link from 'next/link'
import { Camera, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { etiquetaScore, formatoARS } from '@/lib/scoring'
import type { Contact, Consulta } from '@/lib/types'
import type { Etapa } from '@/lib/negocio'

export function hace(iso: string | null): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '?'
  const partes = nombre.replace(',', ' ').split(/\s+/).filter(Boolean)
  return (partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')
}

export const etapaVar = (etapa: Etapa) => ({ ['--etapa-color' as string]: `var(--etapa-${etapa})` })

export function Avatar({ nombre, etapa, className = 'h-9 w-9 text-label-md' }: { nombre: string | null | undefined; etapa: Etapa; className?: string }) {
  return (
    <span className={`avatar flex shrink-0 items-center justify-center rounded-full font-bold uppercase ${className}`} style={etapaVar(etapa)}>
      {iniciales(nombre)}
    </span>
  )
}

export function ContactCard({ c }: { c: Contact }) {
  const et = etiquetaScore(c.score)
  return (
    <Link href={`/contactos/${c.id}`} className="card card-hover block p-3">
      <div className="flex items-center gap-2.5">
        <Avatar nombre={c.name} etapa={c.stage} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body-sm font-semibold leading-tight">{c.name ?? 'Sin nombre'}</div>
          <div className="flex items-center gap-1 text-label-sm text-on-surface-variant"><Phone className="h-3 w-3" />+{c.phone}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={et.variant} className="whitespace-nowrap">{c.score > 0 ? `${c.score} · ${et.label}` : et.label}</Badge>
        {c.datos.monto_solicitado ? <Badge variant="secondary" className="whitespace-nowrap">{formatoARS(c.datos.monto_solicitado)}</Badge> : null}
        {c.cuota ? <Badge variant="secondary" className="whitespace-nowrap">Cuota {formatoARS(c.cuota)}</Badge> : null}
      </div>
      {c.resumen && <p className="mt-2 line-clamp-2 text-label-sm leading-relaxed text-on-surface-variant">{c.resumen}</p>}
      <div className="mt-2 text-label-sm text-on-surface-variant/70">{hace(c.last_message_at)}</div>
    </Link>
  )
}

/** Tarjeta de una consulta mandada por un vendedor. */
export function ConsultaCard({ c, vendedor }: { c: Consulta; vendedor: Contact | undefined }) {
  const et = etiquetaScore(c.score)
  return (
    <Link href={`/consultas/${c.id}`} className="card card-hover block p-3">
      <div className="flex items-center gap-2.5">
        <Avatar nombre={c.nombre_cliente} etapa={c.stage} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body-sm font-semibold leading-tight">{c.nombre_cliente ?? 'Cliente sin nombre'}</div>
          <div className="truncate text-label-sm text-on-surface-variant">{c.dni ? `DNI ${c.dni}` : 'Sin DNI'}{c.banco ? ` · ${c.banco}` : ''}</div>
        </div>
        {c.fotos.length > 0 && <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-label-sm text-on-surface-variant"><Camera className="h-3 w-3" />{c.fotos.length}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={c.completa ? et.variant : 'outline'} className="whitespace-nowrap">{c.completa ? `${c.score} · ${et.label}` : 'Incompleta'}</Badge>
        {c.monto ? <Badge variant="secondary" className="whitespace-nowrap">{formatoARS(c.monto)}</Badge> : null}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 truncate text-label-sm text-tertiary">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tertiary shadow-[0_0_8px_hsl(var(--tertiary))]" />
        <span className="truncate">{vendedor?.name ?? 'Vendedor'}{vendedor?.sucursal ? ` · ${vendedor.sucursal}` : ''}</span>
      </div>
      {c.resumen && <p className="mt-2 line-clamp-2 text-label-sm leading-relaxed text-on-surface-variant">{c.resumen}</p>}
      <div className="mt-2 text-label-sm text-on-surface-variant/70">{hace(c.updated_at)}</div>
    </Link>
  )
}
