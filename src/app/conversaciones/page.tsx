import Link from 'next/link'
import { db } from '@/lib/db'
import { ETAPA_LABEL } from '@/lib/negocio'
import { Badge } from '@/components/ui/badge'
import { AutoRefresh } from '@/components/auto-refresh'
import { hace } from '@/components/contact-card'

export const dynamic = 'force-dynamic'

export default async function Conversaciones() {
  const store = db()
  const contacts = await store.listContacts()
  const ultimos = await Promise.all(contacts.map(async c => {
    const msgs = (await store.listMessages(c.id)).filter(m => m.kind !== 'sistema')
    return { c, last: msgs[msgs.length - 1] ?? null, total: msgs.length }
  }))

  return (
    <div>
      <AutoRefresh />
      <h1 className="mb-5 font-display text-headline-sm font-semibold">Conversaciones</h1>
      <div className="divide-y divide-outline-variant rounded-2xl border border-outline-variant bg-surface-container-low">
        {ultimos.map(({ c, last, total }) => (
          <Link key={c.id} href={`/contactos/${c.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-container">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-label-lg font-semibold">
              {(c.name ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{c.name ?? `+${c.phone}`}</span>
                {c.tipo === 'vendedor' ? <Badge variant="secondary">Vendedor{c.sucursal ? ` · ${c.sucursal}` : ''}</Badge> : <Badge variant="outline">{ETAPA_LABEL[c.stage]}</Badge>}
              </div>
              <div className="truncate text-body-sm text-on-surface-variant">
                {last ? `${last.direction === 'out' ? 'Sofi: ' : ''}${last.body}` : 'Sin mensajes'}
              </div>
            </div>
            <div className="shrink-0 text-right text-label-sm text-on-surface-variant">
              <div>{hace(c.last_message_at)}</div>
              <div>{total} msjs</div>
            </div>
          </Link>
        ))}
        {ultimos.length === 0 && <div className="p-8 text-center text-on-surface-variant">Todavía no hay conversaciones. Probá el simulador.</div>}
      </div>
    </div>
  )
}
