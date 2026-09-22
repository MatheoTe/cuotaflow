import { db, storeKind } from '@/lib/db'
import { ETAPAS, ETAPA_LABEL } from '@/lib/negocio'
import { ContactCard } from '@/components/contact-card'
import { AutoRefresh } from '@/components/auto-refresh'
import { whatsappConfigurado } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function Tablero() {
  const contacts = await db().listContacts()
  const porEtapa = Object.fromEntries(ETAPAS.map(e => [e, contacts.filter(c => c.stage === e)]))

  return (
    <div>
      <AutoRefresh />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-headline-sm font-semibold">Tablero</h1>
          <p className="text-body-sm text-on-surface-variant">{contacts.length} contactos · datos: {storeKind()} · WhatsApp: {whatsappConfigurado() ? 'conectado' : 'sin conectar'}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {ETAPAS.map(etapa => (
          <section key={etapa} className="min-w-0 rounded-2xl bg-surface-container-low p-3">
            <header className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-label-lg font-semibold uppercase tracking-wide text-on-surface-variant">{ETAPA_LABEL[etapa]}</h2>
              <span className="rounded-full bg-surface-container-high px-2 text-label-sm">{porEtapa[etapa].length}</span>
            </header>
            <div className="flex flex-col gap-2">
              {porEtapa[etapa].map(c => <ContactCard key={c.id} c={c} />)}
              {porEtapa[etapa].length === 0 && <div className="rounded-xl border border-dashed border-outline-variant p-4 text-center text-label-md text-on-surface-variant">Vacío</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
