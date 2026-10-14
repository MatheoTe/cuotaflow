import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'

/**
 * Cliente mínimo de la WhatsApp Cloud API (Graph API v21).
 * Con el número de prueba de Meta alcanza para la demo: manda texto libre a los
 * números cargados como destinatarios de prueba, y recibe texto y fotos.
 */
const GRAPH = 'https://graph.facebook.com/v21.0'

export function whatsappConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

const auth = () => ({ Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` })

/**
 * Argentina: WhatsApp identifica a los celulares como 54 9 <área> <número>, pero
 * la lista de destinatarios del número de prueba de Meta los guarda como
 * 54 <área> 15 <número>. Si Meta rechaza el primero (error 131030), se prueba
 * con las variantes del segundo formato (área de 2, 3 o 4 dígitos).
 */
function variantesArgentina(to: string): string[] {
  if (!/^549\d{10}$/.test(to)) return []
  const resto = to.slice(3)
  // Primero área de 3 dígitos (la mayoría del país), después 2 (AMBA) y 4.
  return [3, 2, 4].map(n => `54${resto.slice(0, n)}15${resto.slice(n)}`)
}

export async function enviarTexto(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!whatsappConfigurado()) return { ok: false, error: 'WhatsApp no configurado (falta WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID)' }
  let r = await enviarTextoA(to, body)
  if (!r.ok && r.error?.includes('131030')) {
    // Meta contesta distinto según la variante (131030 o 131005): se prueban todas.
    for (const alt of variantesArgentina(to)) {
      r = await enviarTextoA(alt, body)
      if (r.ok) break
    }
  }
  return r
}

async function enviarTextoA(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[whatsapp] error al enviar', res.status, text)
    return { ok: false, error: `${res.status}: ${text}` }
  }
  return { ok: true }
}

/** Marca el mensaje como leído (los dos tildes azules). Falla en silencio. */
export async function marcarLeido(messageId: string): Promise<void> {
  if (!whatsappConfigurado()) return
  await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch(() => undefined)
}

/** Baja una foto o documento por su media id. Dos pasos: primero la URL firmada, después el binario. */
export async function descargarMedia(mediaId: string): Promise<{ mime: string; data: string } | null> {
  if (!whatsappConfigurado()) return null
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth() })
  if (!meta.ok) { console.error('[whatsapp] media meta', meta.status, await meta.text()); return null }
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string }
  const bin = await fetch(url, { headers: auth() })
  if (!bin.ok) { console.error('[whatsapp] media download', bin.status); return null }
  const buf = Buffer.from(await bin.arrayBuffer())
  return { mime: mime_type, data: buf.toString('base64') }
}

/* ───────────────────────── Webhook entrante ───────────────────────── */

/**
 * Forma del webhook de Meta, solo lo que usamos. Se valida con zod: un payload
 * que no respeta la forma se descarta entero en vez de romper más adelante.
 * Las claves desconocidas se ignoran (Meta agrega campos sin avisar).
 */
const MensajeWebhook = z.object({
  id: z.string().min(1),
  from: z.string().regex(/^\d{6,20}$/),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  button: z.object({ text: z.string() }).optional(),
  interactive: z.object({
    button_reply: z.object({ title: z.string() }).optional(),
    list_reply: z.object({ title: z.string() }).optional(),
  }).optional(),
  image: z.object({ id: z.string(), mime_type: z.string(), caption: z.string().optional() }).optional(),
  document: z.object({ id: z.string(), mime_type: z.string(), caption: z.string().optional(), filename: z.string().optional() }).optional(),
})

export const WebhookSchema = z.object({
  object: z.string().optional(),
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string().optional() }).optional() })).optional(),
        messages: z.array(MensajeWebhook).optional(),
      }).optional(),
    })).optional(),
  })).optional(),
})

export type WebhookPayload = z.infer<typeof WebhookSchema>

/**
 * Verifica la cabecera X-Hub-Signature-256: HMAC-SHA256 del cuerpo crudo con el
 * App Secret de la app de Meta. Comparación en tiempo constante.
 */
export function firmaValida(cuerpo: string, cabecera: string | null, appSecret: string): boolean {
  if (!cabecera?.startsWith('sha256=')) return false
  const esperada = createHmac('sha256', appSecret).update(cuerpo, 'utf8').digest()
  let recibida: Buffer
  try {
    recibida = Buffer.from(cabecera.slice('sha256='.length), 'hex')
  } catch {
    return false
  }
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada)
}

/** Igualdad de secretos en tiempo constante (para el verify token del GET). */
export function mismoSecreto(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export interface Entrante { waId: string; from: string; name: string | null; text: string; mediaId: string | null; mime: string | null }

/** Aplana el payload en mensajes entrantes de texto o con foto. Ignora estados, reacciones, audios. */
export function extraerEntrantes(payload: WebhookPayload): Entrante[] {
  const out: Entrante[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value
      if (!v?.messages) continue
      const nombres = new Map((v.contacts ?? []).map(c => [c.wa_id, c.profile?.name ?? null]))
      for (const m of v.messages) {
        const base = { waId: m.id, from: m.from, name: nombres.get(m.from) ?? null, mediaId: null as string | null, mime: null as string | null }
        if (m.type === 'text' && m.text?.body) out.push({ ...base, text: m.text.body })
        else if (m.type === 'button' && m.button?.text) out.push({ ...base, text: m.button.text })
        else if (m.type === 'interactive') {
          const t = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title
          if (t) out.push({ ...base, text: t })
        } else if (m.type === 'image' && m.image) out.push({ ...base, text: m.image.caption ?? '', mediaId: m.image.id, mime: m.image.mime_type })
        else if (m.type === 'document' && m.document && m.document.mime_type.startsWith('image/')) out.push({ ...base, text: m.document.caption ?? '', mediaId: m.document.id, mime: m.document.mime_type })
      }
    }
  }
  return out
}
