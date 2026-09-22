import { db, storeKind } from '@/lib/db'
import { ETAPAS, ETAPA_LABEL } from '@/lib/negocio'
import { ContactCard, ConsultaCard } from '@/components/contact-card'
import { AutoRefresh } from '@/components/auto-refresh'
import { whatsappConfigurado } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function Tablero() {
  const store = db()
  const [contacts, consultas] = await Promise.all([store.listContacts(), store.listConsultas()])
  const clientes = contacts.filter(c => c.tipo === 'cliente')
  const vendedores = new Map(contacts.filter(c => c.tipo === 'vendedor').map(v => [v.id, v]))

  return (
    <div>
      <AutoRefresh />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-headline-sm font-semibold">Tablero</h1>
          <p className="text-body-sm text-on-surface-variant">
            {clientes.length} clientes · {consultas.length} consultas de {vendedores.size} {vendedores.size === 1 ? 'vendedor' : 'vendedores'} · datos: {storeKind()} · WhatsApp: {whatsappConfigurado() ? 'conectado' : 'sin conectar'}
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {ETAPAS.map(etapa => {
          const cs = consultas.filter(c => c.stage === etapa)
          const cl = clientes.filter(c => c.stage === etapa)
          return (
            <section key={etapa} className="min-w-0 rounded-2xl bg-surface-container-low p-3">
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-label-lg font-semibold uppercase tracking-wide text-on-surface-variant">{ETAPA_LABEL[etapa]}</h2>
                <span className="rounded-full bg-surface-container-high px-2 text-label-sm">{cs.length + cl.length}</span>
              </header>
              <div className="flex flex-col gap-2">
                {cs.map(c => <ConsultaCard key={c.id} c={c} vendedor={vendedores.get(c.vendedor_id)} />)}
                {cl.map(c => <ContactCard key={c.id} c={c} />)}
                {cs.length + cl.length === 0 && <div className="rounded-xl border border-dashed border-outline-variant p-4 text-center text-label-md text-on-surface-variant">Vacío</div>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
