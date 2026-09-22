'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatThread } from '@/components/chat-thread'
import type { Contact, Message } from '@/lib/types'

/**
 * Teléfono de mentira: manda al mismo camino que el webhook de WhatsApp,
 * sin pasar por Meta. Sirve para mostrar el agente en una llamada sin número.
 */
export default function Simulador() {
  const [phone, setPhone] = useState('5491155550001')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async (p: string) => {
    const r = await fetch(`/api/chat?phone=${encodeURIComponent(p)}`)
    const j = await r.json()
    setMessages(j.messages ?? [])
    setContact(j.contact ?? null)
  }, [])

  useEffect(() => { cargar(phone) }, [phone, cargar])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || loading) return
    setText('')
    setError(null)
    setLoading(true)
    const optimista: Message = { id: `tmp-${Date.now()}`, contact_id: '', direction: 'in', kind: 'text', body: t, wa_id: null, created_at: new Date().toISOString() }
    setMessages(m => [...m, optimista])
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, text: t, name: name || undefined }) })
      const j = await r.json()
      if (!r.ok) setError(j.error ?? 'Error')
      await cargar(phone)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[400px_1fr]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-headline-sm font-semibold">Simulador</h1>
          <p className="text-body-sm text-on-surface-variant">Escribí como si fueras un cliente. Cada mensaje entra por el mismo camino que WhatsApp y actualiza el tablero.</p>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <label className="mb-1 block text-label-sm uppercase tracking-wide text-on-surface-variant">Número del cliente</label>
          <Input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
          <label className="mb-1 mt-3 block text-label-sm uppercase tracking-wide text-on-surface-variant">Nombre de perfil (opcional)</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Como aparece en WhatsApp" />
          <p className="mt-3 text-label-md text-on-surface-variant">Cambiá el número para empezar otra conversación.</p>
        </div>
        {contact && (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-body-sm">
            <div className="mb-1 text-label-sm uppercase tracking-wide text-on-surface-variant">Lo que ve el operador</div>
            <div>Etapa: <b>{contact.stage}</b> · Score: <b>{contact.score}</b></div>
            {contact.resumen && <p className="mt-1 text-on-surface-variant">{contact.resumen}</p>}
            <Link href={`/contactos/${contact.id}`} className="mt-2 inline-block text-primary underline-offset-4 hover:underline">Abrir ficha</Link>
          </div>
        )}
      </div>

      <div className="flex h-[75vh] flex-col overflow-hidden rounded-[2rem] border-4 border-surface-container-highest bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container px-4 py-3 text-body-sm font-medium">Créditos Río · WhatsApp</div>
        <div className="flex-1 overflow-y-auto p-4">
          <ChatThread messages={messages} />
          {loading && <div className="bubble-in mt-2 w-fit px-3 py-2 text-label-md text-on-surface-variant">escribiendo…</div>}
          <div ref={bottom} />
        </div>
        {error && <div className="bg-error-container px-4 py-2 text-label-md text-on-error-container">{error}</div>}
        <form onSubmit={enviar} className="flex gap-2 border-t border-outline-variant bg-surface-container p-3">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Escribí un mensaje" autoFocus />
          <Button type="submit" disabled={loading || !text.trim()}>Enviar</Button>
        </form>
      </div>
    </div>
  )
}
