import { NextResponse } from 'next/server'
import { procesarEntrante } from '@/lib/pipeline'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** Simulador: mismo camino que WhatsApp, sin mandar nada a Meta. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string; text?: string; name?: string } | null
  const phone = body?.phone?.replace(/\D/g, '')
  const text = body?.text?.trim()
  if (!phone || !text) return NextResponse.json({ error: 'phone y text son obligatorios' }, { status: 400 })
  try {
    const { contact, reply } = await procesarEntrante({ phone, text, name: body?.name ?? null })
    return NextResponse.json({ reply: reply.body, contact })
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
  const contact = await db().getContactByPhone(phone)
  if (!contact) return NextResponse.json({ messages: [], contact: null })
  const messages = (await db().listMessages(contact.id)).filter(m => m.kind !== 'sistema')
  return NextResponse.json({ messages, contact })
}
