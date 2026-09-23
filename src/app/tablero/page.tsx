import { db, storeKind } from '@/lib/db'
import { ETAPAS, ETAPA_LABEL } from '@/lib/negocio'
import { ContactCard, ConsultaCard, etapaVar } from '@/components/contact-card'
import { AutoRefresh } from '@/components/auto-refresh'
import { whatsappConfigurado } from '@/lib/whatsapp'
import { formatoARS } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export default async function Tablero() {
  const store = db()
  const [contacts, consultas] = await Promise.all([store.listContacts(), store.listConsultas()])
  const clientes = contacts.filter(c => c.tipo === 'cliente')
  const vendedores = new Map(contacts.filter(c => c.tipo === 'vendedor').map(v => [v.id, v]))

  const preaprobados = consultas.filter(c => c.completa && c.score >= 60).length + clientes.filter(c => c.score >= 70).length
  const enVerificacion = consultas.filter(c => c.stage === 'verificacion').length + clientes.filter(c => c.stage === 'verificacion').length
  const montoPipeline = consultas.filter(c => c.stage === 'verificacion').reduce((a, c) => a + (c.monto ?? 0), 0) + clientes.filter(c => c.stage === 'verificacion').reduce((a, c) => a + (c.datos.monto_solicitado ?? 0), 0)
  const abiertas = consultas.filter(c => c.stage === 'nuevo' || c.stage === 'verificacion').length + clientes.filter(c => c.stage === 'nuevo' || c.stage === 'verificacion').length

  const kpis = [
    { label: 'Consultas abiertas', value: String(abiertas), hint: `${consultas.length} de vendedores · ${clientes.length} directas` },
    { label: 'Pre-aprobados', value: String(preaprobados), hint: 'listos para verificación' },
    { label: 'En verificación', value: String(enVerificacion), hint: 'esperan llamada' },
    { label: 'Monto en pipeline', value: formatoARS(montoPipeline), hint: 'pedido por los pre-aprobados' },
  ]

  return (
    <div>
      <AutoRefresh />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <div className="text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">{k.label}</div>
            <div className="kpi-num mt-1 font-display text-headline-md font-semibold">{k.value}</div>
            <div className="text-label-md text-on-surface-variant">{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-3 text-label-md text-on-surface-variant">
        <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${whatsappConfigurado() ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]' : 'bg-warning shadow-[0_0_8px_hsl(var(--warning))]'}`} />WhatsApp {whatsappConfigurado() ? 'conectado' : 'en simulador'}</span>
        <span className="text-on-surface-variant/50">·</span>
        <span>datos: {storeKind()}</span>
        <span className="text-on-surface-variant/50">·</span>
        <span>se actualiza solo</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {ETAPAS.map(etapa => {
          const cs = consultas.filter(c => c.stage === etapa)
          const cl = clientes.filter(c => c.stage === etapa)
          const total = cs.length + cl.length
          return (
            <section key={etapa} data-etapa={etapa} className="pipeline-col min-w-0 overflow-hidden" style={etapaVar(etapa)}>
              <header className="flex items-center gap-2 px-3.5 pb-3 pt-3.5">
                <span className="etapa-dot h-2 w-2 rounded-full" />
                <h2 className="etapa-text text-label-lg font-semibold uppercase tracking-[0.12em]">{ETAPA_LABEL[etapa]}</h2>
                <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-label-sm text-on-surface-variant">{total}</span>
              </header>
              <div className="flex flex-col gap-2 px-2 pb-2.5">
                {cs.map(c => <ConsultaCard key={c.id} c={c} vendedor={vendedores.get(c.vendedor_id)} />)}
                {cl.map(c => <ContactCard key={c.id} c={c} />)}
                {total === 0 && <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-label-md text-on-surface-variant/70">Sin casos</div>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
