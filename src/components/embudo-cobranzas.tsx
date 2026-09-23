import Link from 'next/link'
import { CalendarClock, MessageCircle, PhoneCall, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, hace } from '@/components/contact-card'
import { formatoARS } from '@/lib/scoring'
import { ETAPAS_COBRANZA, ETAPA_COBRANZA_AYUDA, ETAPA_COBRANZA_LABEL, rendimientoOperadores, type Cuenta, type EtapaCobranza, type Gestion } from '@/lib/cobranzas'

export const etapaCobVar = (etapa: EtapaCobranza) => ({ ['--etapa-color' as string]: `var(--etapa-${etapa})` })

const CANAL_ICON = { whatsapp: MessageCircle, llamada: PhoneCall, plantilla: Send, sistema: CalendarClock } as const

export const fechaCorta = (d: string | null) => d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—'

function moraBadge(c: Cuenta) {
  if (c.stage === 'regularizado') return <Badge variant="success" className="whitespace-nowrap">Al día</Badge>
  if (c.dias_mora <= 0) return <Badge variant="outline" className="whitespace-nowrap">Vence {fechaCorta(c.vencimiento)}</Badge>
  if (c.dias_mora <= 30) return <Badge variant="warning" className="whitespace-nowrap">{c.dias_mora} días</Badge>
  return <Badge variant="destructive" className="whitespace-nowrap">{c.dias_mora} días</Badge>
}

export function CuentaCard({ c }: { c: Cuenta }) {
  const ultima: Gestion | undefined = c.gestiones[c.gestiones.length - 1]
  const Icon = ultima ? CANAL_ICON[ultima.canal] : null
  return (
    <Link href={`/cobranzas/${c.id}`} className="card card-hover block p-3">
      <div className="text-body-sm font-semibold leading-tight">{c.nombre}</div>
      <div className="mt-0.5 text-label-sm text-on-surface-variant">{c.nro_credito} · cuota {Math.min(c.cuotas_total, c.cuotas_pagas + Math.max(1, c.cuotas_vencidas))}/{c.cuotas_total}</div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {moraBadge(c)}
        <Badge variant="secondary" className="whitespace-nowrap">{formatoARS(c.stage === 'regularizado' ? c.recuperado : c.saldo_vencido || c.cuota)}</Badge>
      </div>
      {c.stage === 'promesa' && c.promesa_fecha && (
        <div className="mt-2 flex items-center gap-1.5 text-label-sm text-[hsl(var(--etapa-promesa))]">
          <CalendarClock className="h-3 w-3" />Paga {fechaCorta(c.promesa_fecha)} · {formatoARS(c.promesa_monto)}
        </div>
      )}
      {ultima && (
        <p className="mt-2 flex gap-1.5 text-label-sm leading-relaxed text-on-surface-variant">
          {Icon && <Icon className="mt-0.5 h-3 w-3 shrink-0" />}<span className="line-clamp-2">{ultima.nota}</span>
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-label-sm text-on-surface-variant/70">
        <span className="truncate">{c.operador}</span>
        <span className="shrink-0">{hace(c.updated_at)}</span>
      </div>
    </Link>
  )
}

export function EmbudoCobranzas({ cuentas }: { cuentas: Cuenta[] }) {
  const enMora = cuentas.filter(c => c.stage !== 'por_vencer' && c.stage !== 'regularizado')
  const moraTotal = enMora.reduce((a, c) => a + c.saldo_vencido, 0)
  const promesas = cuentas.filter(c => c.stage === 'promesa')
  const recuperado = cuentas.reduce((a, c) => a + c.recuperado, 0)
  const gestionables = cuentas.filter(c => c.stage !== 'por_vencer')
  const contactadas = gestionables.filter(c => c.gestiones.some(g => ['contactado', 'promesa', 'pago'].includes(g.resultado))).length

  const kpis = [
    { label: 'Cartera en mora', value: formatoARS(moraTotal), hint: `${enMora.length} créditos con cuotas vencidas` },
    { label: 'Contactabilidad', value: `${gestionables.length ? Math.round((contactadas / gestionables.length) * 100) : 0}%`, hint: `${contactadas} de ${gestionables.length} deudores respondieron` },
    { label: 'Promesas de pago', value: formatoARS(promesas.reduce((a, c) => a + (c.promesa_monto ?? 0), 0)), hint: `${promesas.length} compromisos abiertos` },
    { label: 'Recuperado del mes', value: formatoARS(recuperado), hint: `${cuentas.filter(c => c.stage === 'regularizado').length} créditos regularizados` },
  ]
  const ops = rendimientoOperadores(cuentas)

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <div className="text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">{k.label}</div>
            <div className="kpi-num mt-1 font-display text-headline-md font-semibold">{k.value}</div>
            <div className="text-label-md text-on-surface-variant">{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {ETAPAS_COBRANZA.map(etapa => {
          const cs = cuentas.filter(c => c.stage === etapa)
          const monto = cs.reduce((a, c) => a + (etapa === 'regularizado' ? c.recuperado : c.saldo_vencido || c.cuota), 0)
          return (
            <section key={etapa} className="pipeline-col min-w-0 overflow-hidden" style={etapaCobVar(etapa)}>
              <header className="px-3.5 pb-3 pt-3.5">
                <div className="flex items-center gap-2">
                  <span className="etapa-dot h-2 w-2 shrink-0 rounded-full" />
                  <h2 className="etapa-text text-label-md font-semibold uppercase tracking-[0.06em]">{ETAPA_COBRANZA_LABEL[etapa]}</h2>
                  <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-label-sm text-on-surface-variant">{cs.length}</span>
                </div>
                <div className="mt-1.5 font-display text-title-sm font-semibold tabular-nums">{formatoARS(monto)}</div>
                <div className="text-label-sm text-on-surface-variant">{ETAPA_COBRANZA_AYUDA[etapa]}</div>
              </header>
              <div className="flex flex-col gap-2 px-2 pb-2.5">
                {cs.map(c => <CuentaCard key={c.id} c={c} />)}
                {cs.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-label-md text-on-surface-variant/70">Sin casos</div>}
              </div>
            </section>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div>
            <h2 className="font-display text-title-md font-semibold">Rendimiento por operador</h2>
            <p className="text-label-md text-on-surface-variant">Gestiones, promesas y recupero de cada persona del área</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-body-sm">
            <thead>
              <tr className="border-y border-white/5 text-left text-label-sm uppercase tracking-[0.12em] text-on-surface-variant">
                <th className="px-5 py-2.5 font-medium">Operador</th>
                <th className="px-3 py-2.5 text-right font-medium">Cuentas</th>
                <th className="px-3 py-2.5 text-right font-medium">Gestiones</th>
                <th className="px-3 py-2.5 font-medium">Contactabilidad</th>
                <th className="px-3 py-2.5 text-right font-medium">Promesas</th>
                <th className="px-3 py-2.5 text-right font-medium">Cumplidas</th>
                <th className="px-5 py-2.5 text-right font-medium">Recupero</th>
              </tr>
            </thead>
            <tbody>
              {ops.map(o => (
                <tr key={o.operador} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5"><Avatar nombre={o.operador} etapa="seguimiento" className="h-7 w-7 text-label-sm" />{o.operador}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{o.asignadas}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{o.gestiones}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-primary" style={{ width: `${o.contactabilidad}%` }} /></span>
                      <span className="tabular-nums text-on-surface-variant">{o.contactabilidad}%</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{o.promesas}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{o.cumplidas}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">{formatoARS(o.recupero)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
