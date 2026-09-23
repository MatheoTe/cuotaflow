import Link from 'next/link'
import { db } from '@/lib/db'
import { ETAPA_LABEL } from '@/lib/negocio'
import { Badge } from '@/components/ui/badge'
import { AutoRefresh } from '@/components/auto-refresh'
import { Avatar, hace } from '@/components/contact-card'

export const dynamic = 'force-dynamic'

export default async function Conversaciones() {
  const store = db()
  const contacts = await store.listContacts()
  const ultimos = await Promise.all(contacts.map(async c => {
    const msgs = (await store.listMessages(c.id)).filter(m => m.kind !== 'sistema')
    return { c, last: msgs[msgs.length - 1] ?? null, total: msgs.length }
  }))

  return (
    <div className="mx-auto max-w-4xl">
      <AutoRefresh />
      <div className="card divide-y divide-white/5">
        {ultimos.map(({ c, last, total }) => (
          <Link key={c.id} href={`/contactos/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.04]">
            <Avatar nombre={c.name} etapa={c.stage} className="h-11 w-11 text-label-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{c.name ?? `+${c.phone}`}</span>
                {c.tipo === 'vendedor' ? <Badge variant="secondary">Vendedor{c.sucursal ? ` · ${c.sucursal}` : ''}</Badge> : <Badge variant="outline">{ETAPA_LABEL[c.stage]}</Badge>}
              </div>
              <div className="truncate text-body-sm text-on-surface-variant">
                {last ? `${last.direction === 'out' ? 'Sofi: ' : ''}${last.kind === 'imagen' ? '📷 Foto' : last.body}` : 'Sin mensajes'}
              </div>
            </div>
            <div className="shrink-0 text-right text-label-sm text-on-surface-variant">
              <div>{hace(c.last_message_at)}</div>
              <div className="text-on-surface-variant/70">{total} msjs</div>
            </div>
          </Link>
        ))}
        {ultimos.length === 0 && <div className="p-10 text-center text-on-surface-variant">Todavía no hay conversaciones. Probá el simulador.</div>}
      </div>
    </div>
  )
}
