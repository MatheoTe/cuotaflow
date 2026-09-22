import type { Message } from '@/lib/types'
import { cn } from '@/lib/utils'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

export function ChatThread({ messages, className }: { messages: Message[]; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {messages.map(m => {
        if (m.kind === 'sistema') {
          return <div key={m.id} className="my-1 self-center rounded-full bg-surface-container-high px-3 py-1 text-label-sm text-on-surface-variant">{m.body}</div>
        }
        const out = m.direction === 'out'
        return (
          <div key={m.id} className={cn('max-w-[80%] px-3 py-2 text-body-sm', out ? 'bubble-out self-end' : 'bubble-in self-start')}>
            {m.kind !== 'text' && <div className="mb-0.5 text-label-sm uppercase tracking-wide opacity-70">{m.kind}</div>}
            <div className="whitespace-pre-wrap">{m.body}</div>
            <div className="mt-1 text-right text-label-sm opacity-60">{hora(m.created_at)}</div>
          </div>
        )
      })}
      {messages.length === 0 && <div className="py-8 text-center text-label-md text-on-surface-variant">Sin mensajes</div>}
    </div>
  )
}
