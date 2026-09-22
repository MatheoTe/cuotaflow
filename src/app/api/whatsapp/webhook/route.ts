import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { procesarEntrante } from '@/lib/pipeline'
import { enviarTexto, extraerEntrantes, marcarLeido, type WebhookPayload } from '@/lib/whatsapp'

export const runtime = 'nodejs'

/** Verificación del webhook (Meta la hace una vez al configurarlo). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('forbidden', { status: 403 })
}

/** Mensajes entrantes. Respondemos 200 enseguida y procesamos después. */
export async function POST(req: Request) {
  let payload: WebhookPayload
  try {
    payload = (await req.json()) as WebhookPayload
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const entrantes = extraerEntrantes(payload)
  if (entrantes.length === 0) return NextResponse.json({ ok: true })

  after(async () => {
    for (const e of entrantes) {
      try {
        if (await db().hasWaMessage(e.waId)) continue // Meta reintenta: no procesar dos veces
        await marcarLeido(e.waId)
        const { contact, reply } = await procesarEntrante({ phone: e.from, text: e.text, name: e.name, waId: e.waId })
        const sent = await enviarTexto(contact.phone, reply.body)
        if (!sent.ok) console.error('[webhook] no se pudo responder a', contact.phone, sent.error)
      } catch (err) {
        console.error('[webhook] error procesando', e.waId, err)
      }
    }
  })
  return NextResponse.json({ ok: true })
}
