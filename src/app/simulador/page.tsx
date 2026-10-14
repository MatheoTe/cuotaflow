'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Paperclip, Phone, Video, MoreVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatThread } from '@/components/chat-thread'
import { NEGOCIO, VENDEDORES, ETAPA_LABEL } from '@/lib/negocio'
import { etiquetaScore, formatoARS } from '@/lib/scoring'
import { Badge } from '@/components/ui/badge'
import { Meter } from '@/components/charts'
import type { Consulta, Contact, Message } from '@/lib/types'

const CLIENTE_DEMO = '5491100000201'
const VENDEDOR_DEMO = VENDEDORES[1]

/**
 * Teléfono de mentira: manda al mismo camino que el webhook de WhatsApp,
 * sin pasar por Meta. Sirve para mostrar el agente en una llamada sin número.
 */
export default function Simulador() {
  const [phone, setPhone] = useState(CLIENTE_DEMO)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [foto, setFoto] = useState<{ mime: string; data: string; preview: string } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [contact, setContact] = useState<Contact | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const aplicar = useCallback((j: { messages?: Message[]; contact?: Contact | null; consulta?: Consulta | null }) => {
    setMessages(j.messages ?? [])
    setContact(j.contact ?? null)
    setConsulta(j.consulta ?? null)
  }, [])

  const cargar = useCallback(async (p: string) => {
    const r = await fetch(`/api/chat?phone=${encodeURIComponent(p)}`)
    aplicar(await r.json())
  }, [aplicar])

  useEffect(() => {
    // Al cambiar de teléfono se recarga el hilo; si cambia de nuevo antes de que llegue, se descarta.
    let vigente = true
    fetch(`/api/chat?phone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(j => { if (vigente) aplicar(j) })
      .catch(() => undefined)
    return () => { vigente = false }
  }, [phone, aplicar])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      setFoto({ mime: f.type, data: url.split(',')[1], preview: url })
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if ((!t && !foto) || loading) return
    setText('')
    setError(null)
    setLoading(true)
    const optimista: Message = { id: `tmp-${Date.now()}`, contact_id: '', direction: 'in', kind: foto ? 'imagen' : 'text', body: t || (foto ? '[foto]' : ''), wa_id: null, media_id: null, created_at: new Date().toISOString() }
    setMessages(m => [...m, optimista])
    const imagen = foto ? { mime: foto.mime, data: foto.data } : undefined
    setFoto(null)
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, text: t, name: name || undefined, imagen }) })
      const j = await r.json()
      if (!r.ok) setError(j.error ?? 'Error')
      await cargar(phone)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const esVendedor = contact?.tipo === 'vendedor' || phone === VENDEDOR_DEMO.phone

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-headline-sm font-semibold">Probá al agente</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Escribí como si fueras un cliente o un vendedor. Cada mensaje entra por el mismo camino que WhatsApp y mueve el pipeline en vivo.</p>
        </div>
        <div className="card p-4">
          <div className="mb-3 flex gap-2">
            <Button size="sm" variant={phone === CLIENTE_DEMO ? 'default' : 'outline'} onClick={() => { setPhone(CLIENTE_DEMO); setName('') }}>Soy cliente</Button>
            <Button size="sm" variant={phone === VENDEDOR_DEMO.phone ? 'default' : 'outline'} onClick={() => { setPhone(VENDEDOR_DEMO.phone); setName(VENDEDOR_DEMO.nombre) }}>Soy vendedor</Button>
          </div>
          <label className="mb-1 block text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Número</label>
          <Input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="bg-black/20" />
          <label className="mb-1 mt-3 block text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Nombre de perfil</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Como aparece en WhatsApp" className="bg-black/20" />
          <p className="mt-3 text-label-md leading-relaxed text-on-surface-variant">
            {esVendedor
              ? 'Como vendedor: mandá nombre, DNI y banco del cliente, o la foto del DNI con el clip. El sistema califica y te contesta.'
              : 'Cambiá el número para empezar otra conversación.'}
          </p>
        </div>
        {contact && (
          <div className="card p-4 text-body-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Ficha en vivo</span>
              {consulta ? (
                <Badge variant={consulta.completa ? etiquetaScore(consulta.score).variant : 'outline'}>{consulta.completa ? `${consulta.score} · ${etiquetaScore(consulta.score).label}` : 'Incompleta'}</Badge>
              ) : (
                <Badge variant={etiquetaScore(contact.score).variant}>{contact.score > 0 ? `${contact.score} · ${etiquetaScore(contact.score).label}` : 'Sin calificar'}</Badge>
              )}
            </div>
            {consulta ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {([
                  ['Cliente', consulta.nombre_cliente],
                  ['DNI', consulta.dni],
                  ['Banco', consulta.banco],
                  ['Monto', consulta.monto ? formatoARS(consulta.monto) : null],
                  ['Teléfono', consulta.telefono_cliente ? `+${consulta.telefono_cliente}` : null],
                  ['Situación', consulta.bureau ? `${consulta.bureau.situacion}` : null],
                  ['Etapa', ETAPA_LABEL[consulta.stage]],
                  ['Fotos', consulta.fotos.length ? String(consulta.fotos.length) : null],
                ] as Array<[string, string | null | undefined]>).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className={v ? 'truncate' : 'text-on-surface-variant/50'}>{v ?? '—'}</dd></div>
                ))}
              </dl>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {([
                  ['Nombre', contact.datos.nombre ?? contact.name],
                  ['Monto', contact.datos.monto_solicitado ? formatoARS(contact.datos.monto_solicitado) : null],
                  ['Destino', contact.datos.destino],
                  ['Trabajo', contact.datos.situacion_laboral],
                  ['Ingresos', contact.datos.ingresos_mensuales ? formatoARS(contact.datos.ingresos_mensuales) : null],
                  ['Edad', contact.datos.edad ? String(contact.datos.edad) : null],
                  ['Turno', contact.datos.turno_verificacion],
                  ['Etapa', ETAPA_LABEL[contact.stage]],
                ] as Array<[string, string | null | undefined]>).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className={v ? 'truncate' : 'text-on-surface-variant/50'}>{v ?? '—'}</dd></div>
                ))}
              </dl>
            )}
            {(consulta ?? contact).score > 0 && <div className="mt-3"><Meter value={(consulta ?? contact).score} color="hsl(var(--primary))" /></div>}
            {(consulta?.resumen ?? contact.resumen) && <p className="mt-3 border-t border-white/5 pt-2 text-label-md leading-relaxed text-on-surface-variant">{consulta?.resumen ?? contact.resumen}</p>}
            <Link href={consulta ? `/consultas/${consulta.id}` : `/contactos/${contact.id}`} className="mt-2 inline-block text-label-md text-primary underline-offset-4 hover:underline">{consulta ? 'Abrir consulta' : 'Abrir ficha'}</Link>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[420px]">
        <div className="phone relative flex h-[78vh] min-h-[560px] flex-col overflow-hidden bg-surface-container-lowest">
          <div className="phone-notch z-10" />
          <div className="flex items-center gap-3 border-b border-white/5 bg-[hsl(200_14%_11%)] px-4 pb-3 pt-9">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-tertiary text-label-lg font-bold text-on-primary">S</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-body-sm font-medium">{NEGOCIO.nombre}</div>
              <div className="text-label-sm text-on-surface-variant">{loading ? 'escribiendo…' : 'en línea'}</div>
            </div>
            <Video className="h-4 w-4 text-on-surface-variant" />
            <Phone className="h-4 w-4 text-on-surface-variant" />
            <MoreVertical className="h-4 w-4 text-on-surface-variant" />
          </div>
          <div className="wa-wallpaper flex-1 overflow-y-auto p-3">
            <ChatThread messages={messages} />
            {loading && <div className="bubble-in mt-2 w-fit px-3 py-2 text-label-md text-on-surface-variant">escribiendo…</div>}
            <div ref={bottom} />
          </div>
          {error && <div className="bg-error-container px-4 py-2 text-label-md text-on-error-container">{error}</div>}
          {foto && (
            <div className="flex items-center gap-3 border-t border-white/5 bg-[hsl(200_14%_11%)] px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.preview} alt="Adjunto" className="h-14 rounded-md" />
              <span className="text-label-md text-on-surface-variant">Foto lista para enviar</span>
              <button type="button" onClick={() => setFoto(null)} className="ml-auto text-on-surface-variant hover:text-on-surface" aria-label="Quitar foto"><X className="h-4 w-4" /></button>
            </div>
          )}
          <form onSubmit={enviar} className="flex items-center gap-2 border-t border-white/5 bg-[hsl(200_14%_11%)] p-2.5">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Adjuntar foto"><Paperclip className="h-4 w-4" /></Button>
            <Input value={text} onChange={e => setText(e.target.value)} placeholder={foto ? 'Texto opcional para la foto' : 'Mensaje'} autoFocus className="rounded-full border-white/10 bg-black/30" />
            <Button type="submit" size="icon" disabled={loading || (!text.trim() && !foto)} aria-label="Enviar">➤</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
