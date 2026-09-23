import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Diagnóstico: manda un texto a un número exacto (sin reintentos) y devuelve la
 * respuesta cruda de Meta. Protegido con el token de verificación del webhook.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('x-verify-token')
  if (!auth || auth !== process.env.WHATSAPP_VERIFY_TOKEN) return new Response('forbidden', { status: 403 })
  const { to, body } = (await req.json().catch(() => ({}))) as { to?: string; body?: string }
  if (!to) return NextResponse.json({ error: 'to requerido' }, { status: 400 })
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: body ?? 'Prueba de envío' } }),
  })
  const text = await res.text()
  return NextResponse.json({ to, status: res.status, meta: text })
}
