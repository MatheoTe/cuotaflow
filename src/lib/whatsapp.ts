/**
 * Cliente mínimo de la WhatsApp Cloud API (Graph API v21).
 * Con el número de prueba de Meta alcanza para la demo: manda texto libre a los
 * números cargados como destinatarios de prueba.
 */
const GRAPH = 'https://graph.facebook.com/v21.0'

export function whatsappConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

export async function enviarTexto(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!whatsappConfigurado()) return { ok: false, error: 'WhatsApp no configurado (falta WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID)' }
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
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
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch(() => undefined)
}

/** Forma del webhook de Meta, solo lo que usamos. */
export interface WebhookPayload {
  object?: string
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>
        messages?: Array<{
          id: string
          from: string
          timestamp: string
          type: string
          text?: { body: string }
          button?: { text: string }
          interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }
        }>
      }
    }>
  }>
}

export interface Entrante { waId: string; from: string; name: string | null; text: string }

/** Aplana el payload en mensajes de texto entrantes. Ignora estados, reacciones, medios. */
export function extraerEntrantes(payload: WebhookPayload): Entrante[] {
  const out: Entrante[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value
      if (!v?.messages) continue
      const nombres = new Map((v.contacts ?? []).map(c => [c.wa_id, c.profile?.name ?? null]))
      for (const m of v.messages) {
        const text =
          m.type === 'text' ? m.text?.body :
          m.type === 'button' ? m.button?.text :
          m.type === 'interactive' ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title) :
          null
        if (!text) continue
        out.push({ waId: m.id, from: m.from, name: nombres.get(m.from) ?? null, text })
      }
    }
  }
  return out
}
