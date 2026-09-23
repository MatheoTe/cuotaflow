import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Inbox, KanbanSquare, ShieldCheck, Wallet, MessageSquare } from 'lucide-react'
import { db } from '@/lib/db'
import { ETAPAS, ETAPA_LABEL, type Etapa } from '@/lib/negocio'
import { etiquetaScore, formatoARS } from '@/lib/scoring'
import { Badge } from '@/components/ui/badge'
import { AutoRefresh } from '@/components/auto-refresh'
import { Avatar, hace } from '@/components/contact-card'
import { Sparkline, Bars, Donut, Meter } from '@/components/charts'
import { ColumnsChart } from '@/components/columns-chart'
import type { Consulta, Contact } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DIAS = 14
const COLOR: Record<Etapa, string> = {
  nuevo: 'hsl(var(--chart-nuevo))',
  verificacion: 'hsl(var(--chart-verificacion))',
  cobranza: 'hsl(var(--chart-cobranza))',
  seguimiento: 'hsl(var(--chart-seguimiento))',
  rechazado: 'hsl(var(--chart-rechazado))',
}

/** Índice de día (0 = hace DIAS-1 días … DIAS-1 = hoy) o -1 si es más viejo. */
function diaDe(iso: string, hoy: Date): number {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const diff = Math.round((hoy.getTime() - d.getTime()) / 86_400_000)
  return diff >= 0 && diff < DIAS ? DIAS - 1 - diff : -1
}

function porDia(items: Array<{ created_at: string }>, hoy: Date, peso: (i: number) => number = () => 1): number[] {
  const out = Array(DIAS).fill(0)
  items.forEach((it, idx) => { const i = diaDe(it.created_at, hoy); if (i >= 0) out[i] += peso(idx) })
  return out
}

const suma = (a: number[]) => a.reduce((x, y) => x + y, 0)
function delta(serie: number[]): number | null {
  const ult = suma(serie.slice(-7)), prev = suma(serie.slice(-14, -7))
  if (prev === 0) return null // sin base de comparación, no se inventa un porcentaje
  return Math.round(((ult - prev) / prev) * 100)
}

export default async function Dashboard() {
  const store = db()
  const [contacts, consultas] = await Promise.all([store.listContacts(), store.listConsultas()])
  const clientes = contacts.filter(c => c.tipo === 'cliente')
  const vendedores = new Map(contacts.filter(c => c.tipo === 'vendedor').map(v => [v.id, v]))
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  // Series diarias
  const sConsultas = porDia(consultas, hoy)
  const sClientes = porDia(clientes, hoy)
  const sTotal = sConsultas.map((v, i) => v + sClientes[i])
  const preaprobadas = [...consultas.filter(c => c.completa && c.score >= 60), ...clientes.filter(c => c.score >= 70)]
  const sPre = porDia(preaprobadas, hoy)
  const verif = [...consultas.filter(c => c.stage === 'verificacion'), ...clientes.filter(c => c.stage === 'verificacion')]
  const sVerif = porDia(verif, hoy)
  const montoPipeline = suma(consultas.filter(c => c.stage === 'verificacion').map(c => c.monto ?? 0)) + suma(clientes.filter(c => c.stage === 'verificacion').map(c => c.datos.monto_solicitado ?? 0))
  const sMonto = porDia([...consultas, ...clientes], hoy, idx => {
    const item = idx < consultas.length ? consultas[idx] : clientes[idx - consultas.length]
    return 'monto' in item ? (item.monto ?? 0) : (item.datos.monto_solicitado ?? 0)
  })

  const kpis = [
    { label: 'Consultas (14 días)', value: String(suma(sTotal)), delta: delta(sTotal), icon: Inbox, color: COLOR.nuevo, chart: <Sparkline values={sTotal} color={COLOR.nuevo} /> },
    { label: 'Pre-aprobados', value: String(preaprobadas.length), delta: delta(sPre), icon: ShieldCheck, color: COLOR.seguimiento, chart: <Bars values={sPre} color={COLOR.seguimiento} /> },
    { label: 'En verificación', value: String(verif.length), delta: delta(sVerif), icon: KanbanSquare, color: COLOR.verificacion, chart: <Sparkline values={sVerif} color={COLOR.verificacion} /> },
    { label: 'Monto en pipeline', value: formatoARS(montoPipeline), delta: delta(sMonto), icon: Wallet, color: COLOR.cobranza, chart: <Bars values={sMonto} color={COLOR.cobranza} /> },
  ]

  const porEtapa = ETAPAS.map(e => ({
    etapa: e,
    label: ETAPA_LABEL[e],
    color: COLOR[e],
    value: consultas.filter(c => c.stage === e).length + clientes.filter(c => c.stage === e).length,
    monto: suma(consultas.filter(c => c.stage === e).map(c => c.monto ?? 0)) + suma(clientes.filter(c => c.stage === e).map(c => c.datos.monto_solicitado ?? 0)),
  }))
  const totalCasos = suma(porEtapa.map(p => p.value))

  const recientes = [...consultas].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6)
  const bandeja = await Promise.all(contacts.slice(0, 5).map(async c => {
    const msgs = (await store.listMessages(c.id)).filter(m => m.kind !== 'sistema')
    return { c, last: msgs[msgs.length - 1] ?? null }
  }))

  const labels = Array.from({ length: DIAS }, (_, i) => { const d = new Date(hoy); d.setDate(d.getDate() - (DIAS - 1 - i)); return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) })

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <AutoRefresh seconds={10} />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${k.color} 18%, transparent)`, color: k.color }}>
                <k.icon className="h-5 w-5" />
              </span>
              {k.delta != null && (
                <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-label-sm ${k.delta >= 0 ? 'bg-primary/15 text-primary' : 'bg-error/15 text-error'}`}>
                  {k.delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(k.delta)}%
                </span>
              )}
            </div>
            <div>
              <div className="text-label-md text-on-surface-variant">{k.label}</div>
              <div className="kpi-num font-display text-headline-md font-semibold">{k.value}</div>
            </div>
            <div className="-mx-1">{k.chart}</div>
          </div>
        ))}
      </div>

      {/* Columna principal */}
      <div className="flex min-w-0 flex-col gap-5">
        <section className="card p-5">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-title-md font-semibold">Consultas recientes</h2>
              <p className="text-label-md text-on-surface-variant">Lo que mandaron los vendedores por WhatsApp</p>
            </div>
            <Link href="/tablero" className="rounded-full border border-white/10 px-3 py-1.5 text-label-md text-on-surface-variant hover:text-on-surface">Ver pipeline</Link>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead className="text-label-sm uppercase tracking-[0.12em] text-on-surface-variant">
                <tr className="border-b border-white/5 text-left">
                  <th className="pb-2 pr-3 font-medium">Cliente</th>
                  <th className="pb-2 pr-3 font-medium">Vendedor</th>
                  <th className="pb-2 pr-3 font-medium">Banco</th>
                  <th className="pb-2 pr-3 text-right font-medium">Monto</th>
                  <th className="pb-2 pr-3 font-medium">Score</th>
                  <th className="pb-2 font-medium">Etapa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recientes.map(q => <FilaConsulta key={q.id} q={q} vendedor={vendedores.get(q.vendedor_id)} />)}
                {recientes.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-on-surface-variant">Todavía no hay consultas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5">
          <header className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="font-display text-title-md font-semibold">Consultas por día</h2>
              <p className="text-label-md text-on-surface-variant">Últimos 14 días</p>
            </div>
            <div className="font-display text-title-lg font-semibold">{suma(sTotal)}</div>
          </header>
          <ColumnsChart labels={labels} series={[{ label: 'De vendedores', color: COLOR.nuevo, values: sConsultas }, { label: 'Clientes directos', color: COLOR.seguimiento, values: sClientes }]} />
        </section>
      </div>

      {/* Columna lateral */}
      <div className="flex min-w-0 flex-col gap-5">
        <section className="card p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-title-md font-semibold">Pipeline</h2>
            <span className="text-label-md text-on-surface-variant">{totalCasos} casos</span>
          </header>
          <div className="flex items-center gap-5">
            <Donut parts={porEtapa} center={{ value: String(totalCasos), label: 'casos' }} size={150} thickness={18} />
            <ul className="flex flex-1 flex-col gap-2 text-body-sm">
              {porEtapa.map(p => (
                <li key={p.etapa} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="flex-1 truncate text-on-surface-variant">{p.label}</span>
                  <span className="font-medium tabular-nums">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {porEtapa.filter(p => p.etapa === 'verificacion' || p.etapa === 'seguimiento').map(p => (
              <div key={p.etapa} className="rounded-xl border border-white/5 bg-black/20 p-3">
                <div className="text-label-sm uppercase tracking-[0.12em] text-on-surface-variant">{p.label}</div>
                <div className="mt-0.5 font-display text-title-md font-semibold tabular-nums">{formatoARS(p.monto)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-title-md font-semibold"><MessageSquare className="h-4 w-4 text-primary" />Bandeja de WhatsApp</h2>
            <Link href="/conversaciones" className="text-label-md text-on-surface-variant hover:text-on-surface">Ver todas</Link>
          </header>
          <ul className="divide-y divide-white/5">
            {bandeja.map(({ c, last }) => (
              <li key={c.id}>
                <Link href={`/contactos/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
                  <Avatar nombre={c.name} etapa={c.stage} className="h-9 w-9 text-label-md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body-sm font-medium">{c.name ?? `+${c.phone}`}</span>
                      <span className="ml-auto shrink-0 text-label-sm text-on-surface-variant">{hace(c.last_message_at)}</span>
                    </div>
                    <div className="truncate text-label-md text-on-surface-variant">{last ? (last.kind === 'imagen' ? 'Foto' : last.body) : 'Sin mensajes'}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function FilaConsulta({ q, vendedor }: { q: Consulta; vendedor: Contact | undefined }) {
  const et = etiquetaScore(q.completa ? q.score : 0)
  return (
    <tr>
      <td className="py-2.5 pr-3">
        <Link href={`/consultas/${q.id}`} className="flex items-center gap-2.5">
          <Avatar nombre={q.nombre_cliente} etapa={q.stage} className="h-8 w-8 text-label-sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{q.nombre_cliente ?? 'Sin nombre'}</span>
            <span className="block text-label-sm text-on-surface-variant">{q.dni ? `DNI ${q.dni}` : 'Sin DNI'}</span>
          </span>
        </Link>
      </td>
      <td className="py-2.5 pr-3 text-on-surface-variant">{vendedor?.name ?? '—'}</td>
      <td className="py-2.5 pr-3 text-on-surface-variant">{q.banco ?? '—'}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{formatoARS(q.monto)}</td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <span className="w-7 text-right tabular-nums">{q.completa ? q.score : '—'}</span>
          <Meter value={q.completa ? q.score : 0} color={COLOR[q.stage]} className="w-20" />
        </div>
      </td>
      <td className="py-2.5"><Badge variant={q.completa ? et.variant : 'outline'} className="whitespace-nowrap">{ETAPA_LABEL[q.stage]}</Badge></td>
    </tr>
  )
}
