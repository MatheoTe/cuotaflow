'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, CheckCircle2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Meter } from '@/components/charts'
import { etiquetaScore, formatoARS } from '@/lib/scoring'
import { ETAPA_LABEL, VENDEDORES } from '@/lib/negocio'
import type { Consulta } from '@/lib/types'

const BANCOS = ['Banco Nación', 'Banco Provincia', 'Banco Macro', 'Banco Galicia', 'Banco Santander', 'BBVA', 'Banco Ciudad', 'Otro']

interface Resultado { reply: string; consulta: Consulta | null; envio: string }

/**
 * Formulario de consulta para el vendedor. Es lo mismo que mandar el mensaje
 * por WhatsApp: entra por el mismo camino, califica igual y la respuesta le
 * vuelve al vendedor por WhatsApp.
 */
export default function ConsultaForm() {
  const [form, setForm] = useState({ vendedor_nombre: VENDEDORES[1].nombre, vendedor_phone: VENDEDORES[1].phone, nombre_cliente: '', dni: '', banco: '', monto: '', telefono_cliente: '' })
  const [foto, setFoto] = useState<{ mime: string; data: string; preview: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => { const url = String(reader.result); setFoto({ mime: f.type, data: url.split(',')[1], preview: url }) }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true); setError(null); setResultado(null)
    try {
      const r = await fetch('/api/consulta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, imagen: foto ? { mime: foto.mime, data: foto.data } : undefined }) })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Error'); return }
      setResultado(j)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  function otra() {
    setResultado(null); setFoto(null)
    setForm(f => ({ ...f, nombre_cliente: '', dni: '', banco: '', monto: '', telefono_cliente: '' }))
  }

  const c = resultado?.consulta ?? null
  const et = c ? etiquetaScore(c.completa ? c.score : 0) : null

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_400px]">
      <form onSubmit={enviar} className="card p-6">
        <h1 className="font-display text-headline-sm font-semibold">Nueva consulta de crédito</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">Lo mismo que mandar los datos por WhatsApp, pero en un formulario. El sistema califica al instante y le responde al vendedor por WhatsApp.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 mb-1 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Vendedor</div>
          <div><Label htmlFor="vn">Nombre</Label><Input id="vn" value={form.vendedor_nombre} onChange={set('vendedor_nombre')} className="mt-1 bg-black/20" /></div>
          <div><Label htmlFor="vp">Tu WhatsApp</Label><Input id="vp" value={form.vendedor_phone} onChange={set('vendedor_phone')} inputMode="numeric" placeholder="5491100001234" className="mt-1 bg-black/20" /></div>

          <div className="sm:col-span-2 mb-1 mt-2 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Cliente</div>
          <div><Label htmlFor="nc">Apellido y nombre</Label><Input id="nc" value={form.nombre_cliente} onChange={set('nombre_cliente')} placeholder="Pérez, Juan" className="mt-1 bg-black/20" /></div>
          <div><Label htmlFor="dni">DNI</Label><Input id="dni" value={form.dni} onChange={set('dni')} inputMode="numeric" placeholder="30111222" className="mt-1 bg-black/20" /></div>
          <div>
            <Label htmlFor="banco">Banco donde cobra</Label>
            <select id="banco" value={form.banco} onChange={set('banco')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-black/20 px-3 text-body-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Elegir</option>
              {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div><Label htmlFor="monto">Monto pedido (ARS)</Label><Input id="monto" value={form.monto} onChange={set('monto')} inputMode="numeric" placeholder="500000" className="mt-1 bg-black/20" /></div>
          <div className="sm:col-span-2"><Label htmlFor="tc">Teléfono del cliente (opcional)</Label><Input id="tc" value={form.telefono_cliente} onChange={set('telefono_cliente')} inputMode="numeric" placeholder="5491166554433" className="mt-1 bg-black/20" /></div>

          <div className="sm:col-span-2">
            <Label>Foto del DNI</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
            {foto ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.preview} alt="DNI" className="h-16 rounded-md" />
                <span className="text-label-md text-on-surface-variant">Si el nombre o el DNI vienen vacíos, se leen de la foto.</span>
                <button type="button" onClick={() => setFoto(null)} className="ml-auto text-on-surface-variant hover:text-on-surface" aria-label="Quitar foto"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-5 text-body-sm text-on-surface-variant transition-colors hover:border-primary/50 hover:text-on-surface">
                <Camera className="h-4 w-4" /> Adjuntar foto del DNI (opcional)
              </button>
            )}
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg bg-error-container px-3 py-2 text-label-md text-on-error-container">{error}</div>}
        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" disabled={loading}><Send className="h-4 w-4" />{loading ? 'Calificando…' : 'Enviar consulta'}</Button>
          {resultado && <Button type="button" variant="outline" onClick={otra}>Cargar otra</Button>}
        </div>
      </form>

      <aside className="flex flex-col gap-4">
        {!resultado && !loading && (
          <div className="card p-5 text-body-sm text-on-surface-variant">
            <div className="mb-2 text-label-sm uppercase tracking-[0.14em]">Qué pasa al enviar</div>
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>La consulta entra al CRM como si el vendedor la hubiera mandado por WhatsApp.</li>
              <li>El sistema consulta la situación crediticia por DNI y calcula el score.</li>
              <li>La respuesta aparece acá y le llega al vendedor por WhatsApp.</li>
            </ol>
          </div>
        )}
        {loading && (
          <div className="card flex items-center gap-3 p-5 text-body-sm text-on-surface-variant">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />Consultando bureau y calificando…
          </div>
        )}
        {resultado && (
          <>
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-primary"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">Consulta registrada</span></div>
              {c && (
                <>
                  <div className="font-display text-title-lg font-semibold">{c.nombre_cliente ?? 'Sin nombre'}</div>
                  <div className="text-label-md text-on-surface-variant">{c.dni ? `DNI ${c.dni}` : 'Sin DNI'}{c.banco ? ` · ${c.banco}` : ''}{c.monto ? ` · ${formatoARS(c.monto)}` : ''}</div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="font-display text-headline-md font-semibold tabular-nums">{c.completa ? c.score : '—'}</span>
                    <div className="flex-1"><Meter value={c.completa ? c.score : 0} color="hsl(var(--primary))" /></div>
                    {et && <Badge variant={c.completa ? et.variant : 'outline'}>{c.completa ? et.label : 'Incompleta'}</Badge>}
                  </div>
                  <div className="mt-2 text-label-md text-on-surface-variant">Etapa: {ETAPA_LABEL[c.stage]}</div>
                  <Link href={`/consultas/${c.id}`} className="mt-3 inline-block text-label-md text-primary underline-offset-4 hover:underline">Abrir en el CRM</Link>
                </>
              )}
            </div>
            <div className="card p-5">
              <div className="mb-2 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">Respuesta al vendedor</div>
              <div className="bubble-out px-3 py-2 text-body-sm">{resultado.reply}</div>
              <div className="mt-2 text-label-sm text-on-surface-variant">{resultado.envio}</div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
