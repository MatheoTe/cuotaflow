import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { etiquetaScore, formatoARS } from '@/lib/scoring'
import type { Contact, Consulta } from '@/lib/types'

export function hace(iso: string | null): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export function ContactCard({ c }: { c: Contact }) {
  const et = etiquetaScore(c.score)
  return (
    <Link href={`/contactos/${c.id}`} className="block rounded-xl border border-outline-variant bg-surface-container p-3 transition-colors hover:border-primary/60">
      <div className="min-w-0">
        <div className="truncate font-medium">{c.name ?? 'Sin nombre'}</div>
        <div className="text-label-md text-on-surface-variant">+{c.phone}</div>
      </div>
      <Badge variant={et.variant} className="mt-2 whitespace-nowrap">{c.score > 0 ? `${c.score} · ${et.label}` : et.label}</Badge>
      {c.datos.monto_solicitado ? (
        <div className="mt-2 text-body-sm">{formatoARS(c.datos.monto_solicitado)}{c.datos.destino ? ` · ${c.datos.destino}` : ''}</div>
      ) : c.cuota ? (
        <div className="mt-2 text-body-sm">Cuota {formatoARS(c.cuota)}{c.vencimiento ? ` · vence ${c.vencimiento}` : ''}</div>
      ) : null}
      {c.resumen && <p className="mt-2 line-clamp-2 text-label-md text-on-surface-variant">{c.resumen}</p>}
      <div className="mt-2 text-label-sm text-on-surface-variant">{hace(c.last_message_at)}</div>
    </Link>
  )
}

/** Tarjeta de una consulta mandada por un vendedor. */
export function ConsultaCard({ c, vendedor }: { c: Consulta; vendedor: Contact | undefined }) {
  const et = etiquetaScore(c.score)
  return (
    <Link href={`/consultas/${c.id}`} className="block rounded-xl border border-tertiary/40 bg-surface-container p-3 transition-colors hover:border-tertiary">
      <div className="mb-1 flex items-center gap-1.5 text-label-sm uppercase tracking-wide text-tertiary">
        Consulta · {vendedor?.name ?? 'vendedor'}{vendedor?.sucursal ? ` · ${vendedor.sucursal}` : ''}
      </div>
      <div className="truncate font-medium">{c.nombre_cliente ?? 'Cliente sin nombre'}</div>
      <div className="text-label-md text-on-surface-variant">{c.dni ? `DNI ${c.dni}` : 'Sin DNI'}{c.banco ? ` · ${c.banco}` : ''}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={c.completa ? et.variant : 'outline'} className="whitespace-nowrap">{c.completa ? `${c.score} · ${et.label}` : 'Incompleta'}</Badge>
        {c.fotos.length > 0 && <Badge variant="secondary" className="whitespace-nowrap">{c.fotos.length} {c.fotos.length === 1 ? 'foto' : 'fotos'}</Badge>}
      </div>
      {c.monto ? <div className="mt-2 text-body-sm">{formatoARS(c.monto)}</div> : null}
      {c.resumen && <p className="mt-2 line-clamp-2 text-label-md text-on-surface-variant">{c.resumen}</p>}
      <div className="mt-2 text-label-sm text-on-surface-variant">{hace(c.updated_at)}</div>
    </Link>
  )
}
