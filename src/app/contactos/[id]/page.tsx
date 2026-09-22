import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { ETAPA_LABEL } from '@/lib/negocio'
import { calcularScore, etiquetaScore, formatoARS } from '@/lib/scoring'
import { Badge } from '@/components/ui/badge'
import { ChatThread } from '@/components/chat-thread'
import { ContactActions } from '@/components/contact-actions'
import { AutoRefresh } from '@/components/auto-refresh'

export const dynamic = 'force-dynamic'

const LABORAL: Record<string, string> = {
  relacion_dependencia: 'Relación de dependencia',
  monotributista: 'Monotributista',
  jubilado: 'Jubilado',
  informal: 'Informal',
  desempleado: 'Sin trabajo',
  desconocida: 'Sin dato',
}

export default async function Contacto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = db()
  const c = await store.getContact(id)
  if (!c) notFound()
  const messages = await store.listMessages(c.id)
  const { score, razones } = calcularScore(c.datos)
  const et = etiquetaScore(score)

  const filas: Array<[string, string]> = [
    ['Teléfono', `+${c.phone}`],
    ['Monto pedido', formatoARS(c.datos.monto_solicitado)],
    ['Destino', c.datos.destino ?? '—'],
    ['Situación laboral', c.datos.situacion_laboral ? LABORAL[c.datos.situacion_laboral] : '—'],
    ['Ingresos', formatoARS(c.datos.ingresos_mensuales)],
    ['Edad', c.datos.edad ? String(c.datos.edad) : '—'],
    ['Provincia', c.datos.provincia ?? '—'],
    ['Turno verificación', c.datos.turno_verificacion ?? '—'],
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <AutoRefresh />
      <section className="flex min-h-[70vh] flex-col rounded-2xl border border-outline-variant bg-surface-container-low">
        <header className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
          <Link href="/tablero" className="text-on-surface-variant hover:text-on-surface"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{c.name ?? `+${c.phone}`}</div>
            <div className="text-label-md text-on-surface-variant">{ETAPA_LABEL[c.stage]}{c.proximo_paso ? ` · ${c.proximo_paso}` : ''}</div>
          </div>
          <Badge variant={et.variant}>{score > 0 ? `${score} · ${et.label}` : et.label}</Badge>
        </header>
        <ChatThread messages={messages} className="flex-1 overflow-y-auto p-4" />
      </section>

      <aside className="flex flex-col gap-5">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h2 className="mb-3 text-label-sm uppercase tracking-wide text-on-surface-variant">Ficha</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-sm">
            {filas.map(([k, v]) => (<div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="truncate">{v}</dd></div>))}
          </dl>
          {c.resumen && <p className="mt-3 border-t border-outline-variant pt-3 text-body-sm">{c.resumen}</p>}
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h2 className="mb-2 text-label-sm uppercase tracking-wide text-on-surface-variant">Calificación del sistema</h2>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
          </div>
          <ul className="list-disc space-y-1 pl-4 text-label-md text-on-surface-variant">
            {razones.map(r => <li key={r}>{r}</li>)}
            {razones.length === 0 && <li>Todavía no hay datos para calificar.</li>}
          </ul>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <ContactActions c={c} />
        </div>
      </aside>
    </div>
  )
}
