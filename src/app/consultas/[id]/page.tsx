import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { db } from '@/lib/db'
import { ETAPA_LABEL } from '@/lib/negocio'
import { calcularScoreConsulta, etiquetaScore, formatoARS, montoSugerido } from '@/lib/scoring'
import { Badge } from '@/components/ui/badge'
import { ChatThread } from '@/components/chat-thread'
import { ConsultaActions } from '@/components/consulta-actions'
import { AutoRefresh } from '@/components/auto-refresh'
import { Avatar } from '@/components/contact-card'

export const dynamic = 'force-dynamic'

export default async function ConsultaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = db()
  const c = await store.getConsulta(id)
  if (!c) notFound()
  const vendedor = await store.getContact(c.vendedor_id)
  const hilo = vendedor ? await store.listMessages(vendedor.id) : []
  const { score, razones } = calcularScoreConsulta(c)
  const et = etiquetaScore(c.completa ? score : 0)

  const filas: Array<[string, string]> = [
    ['Cliente', c.nombre_cliente ?? '—'],
    ['DNI', c.dni ?? '—'],
    ['Banco donde cobra', c.banco ?? '—'],
    ['Monto pedido', formatoARS(c.monto)],
    ['Teléfono del cliente', c.telefono_cliente ? `+${c.telefono_cliente}` : '—'],
    ['Vendedor', vendedor ? `${vendedor.name ?? `+${vendedor.phone}`}${vendedor.sucursal ? ` · ${vendedor.sucursal}` : ''}` : '—'],
    ['Recibida', new Date(c.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })],
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <AutoRefresh />
      <section className="flex flex-col gap-6">
        <header className="flex items-center gap-3">
          <Link href="/tablero" className="text-on-surface-variant hover:text-on-surface"><ArrowLeft className="h-4 w-4" /></Link>
          <Avatar nombre={c.nombre_cliente} etapa={c.stage} className="h-12 w-12 text-title-md" />
          <div className="min-w-0 flex-1">
            <div className="text-label-sm uppercase tracking-[0.14em] text-tertiary">Consulta de vendedor</div>
            <div className="truncate font-display text-title-lg font-semibold">{c.nombre_cliente ?? 'Cliente sin nombre'}</div>
            <div className="text-label-md text-on-surface-variant">{ETAPA_LABEL[c.stage]}{c.proximo_paso ? ` · ${c.proximo_paso}` : ''}</div>
          </div>
          <Badge variant={et.variant}>{c.completa ? `${score} · ${et.label}` : 'Incompleta'}</Badge>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Datos</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-sm">
              {filas.map(([k, v]) => (<div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="truncate">{v}</dd></div>))}
            </dl>
            {c.resumen && <p className="mt-3 border-t border-outline-variant pt-3 text-body-sm">{c.resumen}</p>}
          </div>

          <div className="card p-4">
            <h2 className="mb-2 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Calificación del sistema</h2>
            <div className="score-bar mb-2 h-2 overflow-hidden rounded-full">
              <div className="score-fill h-full rounded-full" style={{ width: `${c.completa ? score : 0}%` }} />
            </div>
            <ul className="list-disc space-y-1 pl-4 text-label-md text-on-surface-variant">
              {razones.map(r => <li key={r}>{r}</li>)}
            </ul>
            {c.bureau && (
              <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-body-sm">
                <div className="flex items-center justify-between">
                  <span>Situación <b>{c.bureau.situacion}</b></span>
                  <span className="text-on-surface-variant">Deuda informada: {formatoARS(c.bureau.deuda_total)}</span>
                </div>
                {score >= 60 && <div className="mt-1 text-primary">Pre-aprobado hasta {formatoARS(montoSugerido(c.bureau))}</div>}
                <div className="mt-2 text-label-sm text-on-surface-variant">Bureau simulado para la demo. En producción acá se conecta la consulta real (BCRA, Veraz u otro proveedor).</div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Documentación adjunta ({c.fotos.length})</h2>
          {c.fotos.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">El vendedor no mandó fotos para esta consulta.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {c.fotos.map(id => (
                <a key={id} href={`/api/media/${id}`} target="_blank" rel="noreferrer" className="card card-hover block overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/media/${id}`} alt="Documento" className="h-40 w-auto object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <div className="card p-4">
          <ConsultaActions c={c} />
        </div>
        <div className="card flex max-h-[70vh] flex-col overflow-hidden">
          <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-on-surface-variant" />
            <div className="min-w-0 flex-1 truncate text-body-sm font-medium">Chat con {vendedor?.name ?? 'el vendedor'}</div>
            {vendedor && <Link href={`/contactos/${vendedor.id}`} className="text-label-md text-primary underline-offset-4 hover:underline">Abrir</Link>}
          </header>
          <ChatThread messages={hilo} className="wa-wallpaper flex-1 overflow-y-auto p-3" />
        </div>
      </aside>
    </div>
  )
}
