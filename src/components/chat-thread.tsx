import { Check, CheckCheck } from 'lucide-react'
import type { Message } from '@/lib/types'
import { cn } from '@/lib/utils'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

export function ChatThread({ messages, className }: { messages: Message[]; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {messages.map(m => {
        if (m.kind === 'sistema') {
          return <div key={m.id} className="my-1.5 max-w-[90%] self-center rounded-lg bg-black/30 px-3 py-1 text-center text-label-sm text-on-surface-variant shadow-sm">{m.body}</div>
        }
        const out = m.direction === 'out'
        return (
          <div key={m.id} className={cn('max-w-[78%] px-3 py-1.5 text-body-sm', out ? 'bubble-out self-end' : 'bubble-in self-start')}>
            {m.kind !== 'text' && m.kind !== 'imagen' && <div className="mb-0.5 text-label-sm uppercase tracking-wide opacity-70">{m.kind}</div>}
            {m.media_id && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${m.media_id}`} alt="Foto recibida" className="mb-1 mt-1 max-h-64 rounded-lg" />
            )}
            {m.body && m.body !== '[foto]' && <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>}
            <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-60">
              {hora(m.created_at)}
              {out ? <CheckCheck className="h-3 w-3 text-tertiary" /> : <Check className="h-3 w-3" />}
            </div>
          </div>
        )
      })}
      {messages.length === 0 && <div className="py-8 text-center text-label-md text-on-surface-variant">Sin mensajes</div>}
    </div>
  )
}
