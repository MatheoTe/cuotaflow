import { NextResponse } from 'next/server'
import { procesarEntrante } from '@/lib/pipeline'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const MAX_IMAGEN_BYTES = 4 * 1024 * 1024

/** Simulador: mismo camino que WhatsApp, sin mandar nada a Meta. Acepta una foto en base64. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string; text?: string; name?: string; imagen?: { mime: string; data: string } } | null
  const phone = body?.phone?.replace(/\D/g, '')
  const text = body?.text?.trim() ?? ''
  const imagen = body?.imagen && /^image\/(jpeg|png|gif|webp)$/.test(body.imagen.mime) ? body.imagen : null
  if (!phone || (!text && !imagen)) return NextResponse.json({ error: 'phone y text (o una foto) son obligatorios' }, { status: 400 })
  if (imagen && imagen.data.length * 0.75 > MAX_IMAGEN_BYTES) return NextResponse.json({ error: 'La foto supera los 4 MB' }, { status: 413 })
  try {
    const { contact, reply, consulta } = await procesarEntrante({ phone, text, name: body?.name ?? null, imagen })
    return NextResponse.json({ reply: reply.body, contact, consulta })
  } catch (err) {
    console.error('[chat] error', err)
    const msg = err instanceof Error ? err.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Historial del simulador para un teléfono. */
export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get('phone')?.replace(/\D/g, '')
  if (!phone) return NextResponse.json({ messages: [] })
  const store = db()
  const contact = await store.getContactByPhone(phone)
  if (!contact) return NextResponse.json({ messages: [], contact: null, consulta: null })
  const messages = (await store.listMessages(contact.id)).filter(m => m.kind !== 'sistema')
  const consulta = contact.tipo === 'vendedor' ? await store.getConsultaActiva(contact.id) : null
  return NextResponse.json({ messages, contact, consulta })
}
