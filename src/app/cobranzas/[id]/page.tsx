import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarClock, MessageCircle, PhoneCall, Send } from 'lucide-react'
import { cobranzas, ETAPA_COBRANZA_LABEL, type Gestion } from '@/lib/cobranzas'
import { formatoARS } from '@/lib/scoring'
import { Badge } from '@/components/ui/badge'
import { CobranzaActions } from '@/components/cobranza-actions'
import { etapaCobVar, fechaCorta } from '@/components/embudo-cobranzas'

export const dynamic = 'force-dynamic'

const CANAL: Record<Gestion['canal'], { label: string; icon: typeof Send }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  llamada: { label: 'Llamada', icon: PhoneCall },
  plantilla: { label: 'Plantilla', icon: Send },
  sistema: { label: 'Sistema', icon: CalendarClock },
}

const RESULTADO: Record<Gestion['resultado'], string> = {
  sin_respuesta: 'Sin respuesta',
  contactado: 'Contactado',
  promesa: 'Promesa de pago',
  pago: 'Pago',
  recordatorio: 'Recordatorio',
  cambio_etapa: 'Cambio de etapa',
}

export default async function CuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await cobranzas().get(id)
  if (!c) notFound()

  const deuda: Array<[string, string]> = [
    ['Crédito', `${c.nro_credito} · ${c.producto}`],
    ['DNI', c.dni ?? '—'],
    ['Teléfono', c.telefono ? `+${c.telefono}` : '—'],
    ['Cuota', formatoARS(c.cuota)],
    ['Cuotas pagas', `${c.cuotas_pagas} de ${c.cuotas_total}`],
    ['Cuotas vencidas', String(c.cuotas_vencidas)],
    ['Vencimiento', fechaCorta(c.vencimiento)],
    ['Operador', c.operador ?? '—'],
  ]
  const gestiones = [...c.gestiones].reverse()

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-6">
        <header className="flex items-center gap-3">
          <Link href="/tablero?embudo=cobranzas" className="text-on-surface-variant hover:text-on-surface"><ArrowLeft className="h-4 w-4" /></Link>
          <span className="avatar flex h-12 w-12 items-center justify-center rounded-full text-title-md font-bold uppercase" style={etapaCobVar(c.stage)}>
            {c.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-label-sm uppercase tracking-[0.14em] text-[hsl(var(--etapa-promesa))]">Cobranzas</div>
            <div className="truncate font-display text-title-lg font-semibold">{c.nombre}</div>
            <div className="text-label-md text-on-surface-variant">{ETAPA_COBRANZA_LABEL[c.stage]}{c.dias_mora > 0 ? ` · ${c.dias_mora} días de mora` : ''}</div>
          </div>
          <Badge variant={c.stage === 'regularizado' ? 'success' : c.dias_mora > 30 ? 'destructive' : c.dias_mora > 0 ? 'warning' : 'outline'}>
            {c.stage === 'regularizado' ? 'Al día' : c.dias_mora > 0 ? `Debe ${formatoARS(c.saldo_vencido)}` : `Vence ${fechaCorta(c.vencimiento)}`}
          </Badge>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Crédito</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-sm">
              {deuda.map(([k, v]) => (<div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="truncate">{v}</dd></div>))}
            </dl>
          </div>
          <div className="card flex flex-col gap-4 p-4">
            <h2 className="text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Estado de la deuda</h2>
            <div>
              <div className="text-label-md text-on-surface-variant">Saldo vencido</div>
              <div className="kpi-num font-display text-headline-md font-semibold">{formatoARS(c.saldo_vencido)}</div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-label-md text-on-surface-variant"><span>Avance del crédito</span><span>{Math.round((c.cuotas_pagas / c.cuotas_total) * 100)}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${(c.cuotas_pagas / c.cuotas_total) * 100}%` }} /></div>
            </div>
            {c.promesa_fecha && (
              <div className="rounded-xl border border-[hsl(var(--etapa-promesa)/0.3)] bg-[hsl(var(--etapa-promesa)/0.08)] p-3 text-body-sm">
                <div className="flex items-center gap-2 font-medium text-[hsl(var(--etapa-promesa))]"><CalendarClock className="h-4 w-4" />Promesa de pago</div>
                <div className="mt-1">{formatoARS(c.promesa_monto)} el {fechaCorta(c.promesa_fecha)}</div>
              </div>
            )}
            {c.recuperado > 0 && <div className="text-body-sm text-on-surface-variant">Recuperado: <span className="font-medium text-primary">{formatoARS(c.recuperado)}</span></div>}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-4 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Historial de gestiones</h2>
          {gestiones.length === 0 && <p className="text-body-sm text-on-surface-variant">Todavía no hay gestiones.</p>}
          <ol className="relative flex flex-col gap-4 border-l border-white/10 pl-5">
            {gestiones.map((g, i) => {
              const { label, icon: Icon } = CANAL[g.canal]
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-[29px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-container-high ring-4 ring-[hsl(228_20%_8%)]"><Icon className="h-2.5 w-2.5 text-on-surface-variant" /></span>
                  <div className="flex flex-wrap items-center gap-2 text-label-md">
                    <span className="font-medium">{RESULTADO[g.resultado]}</span>
                    <span className="text-on-surface-variant">· {label} · {g.operador}</span>
                    {g.monto ? <Badge variant="secondary">{formatoARS(g.monto)}</Badge> : null}
                    <span className="ml-auto text-label-sm text-on-surface-variant/70">{new Date(g.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                  <p className="mt-0.5 text-body-sm text-on-surface-variant">{g.nota}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <aside className="card h-fit p-4">
        <CobranzaActions c={c} />
      </aside>
    </div>
  )
}
