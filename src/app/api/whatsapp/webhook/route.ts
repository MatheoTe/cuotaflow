import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { procesarEntrante } from '@/lib/pipeline'
import { esDemo } from '@/lib/demo'
import { descargarMedia, enviarTexto, extraerEntrantes, firmaValida, marcarLeido, mismoSecreto, WebhookSchema } from '@/lib/whatsapp'

export const runtime = 'nodejs'

/** La demo pública no tiene línea de WhatsApp: el webhook no existe. */
const apagadoEnDemo = () => NextResponse.json({ error: 'not found' }, { status: 404 })

/** Verificación del webhook (Meta la hace una vez al configurarlo). */
export async function GET(req: Request) {
  if (esDemo()) return apagadoEnDemo()
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && mismoSecreto(token, process.env.WHATSAPP_VERIFY_TOKEN)) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('forbidden', { status: 403 })
}

/**
 * IDs en vuelo en esta instancia. Meta reintenta si no contestamos rápido; el
 * set cubre el reintento que llega mientras el primero todavía está corriendo,
 * y la restricción unique sobre messages.wa_id cubre el resto (otras instancias).
 */
const enProceso = new Set<string>()
let avisoSinFirma = false

/** Mensajes entrantes. Respondemos 200 enseguida y procesamos después. */
export async function POST(req: Request) {
  if (esDemo()) return apagadoEnDemo()
  const cuerpo = await req.text()

  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (appSecret) {
    if (!firmaValida(cuerpo, req.headers.get('x-hub-signature-256'), appSecret)) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  } else if (!avisoSinFirma) {
    avisoSinFirma = true
    console.warn('[webhook] WHATSAPP_APP_SECRET no está configurado: no se verifica la firma de Meta')
  }

  let json: unknown
  try {
    json = JSON.parse(cuerpo)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const parsed = WebhookSchema.safeParse(json)
  if (!parsed.success) {
    console.error('[webhook] payload con forma inesperada', parsed.error.issues.slice(0, 3))
    // 200 igual: si respondemos error, Meta reintenta el mismo payload inválido.
    return NextResponse.json({ ok: true })
  }

  const entrantes = extraerEntrantes(parsed.data).filter(e => !enProceso.has(e.waId))
  if (entrantes.length === 0) return NextResponse.json({ ok: true })
  for (const e of entrantes) enProceso.add(e.waId)

  after(async () => {
    for (const e of entrantes) {
      try {
        if (await db().hasWaMessage(e.waId)) continue // Meta reintenta: no procesar dos veces
        await marcarLeido(e.waId)
        const imagen = e.mediaId ? await descargarMedia(e.mediaId) : null
        if (e.mediaId && !imagen) console.error('[webhook] no se pudo bajar la foto', e.mediaId)
        const { contact, reply } = await procesarEntrante({ phone: e.from, text: e.text, name: e.name, waId: e.waId, imagen })
        const sent = await enviarTexto(contact.phone, reply.body)
        if (!sent.ok) console.error('[webhook] no se pudo responder a', contact.phone, sent.error)
      } catch (err) {
        console.error('[webhook] error procesando', e.waId, err)
      } finally {
        enProceso.delete(e.waId)
      }
    }
  })
  return NextResponse.json({ ok: true })
}
