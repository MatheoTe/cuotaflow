import { NextResponse } from 'next/server'
import { procesarEntrante } from '@/lib/pipeline'
import { enviarTexto, whatsappConfigurado } from '@/lib/whatsapp'
import { VENDEDORES } from '@/lib/negocio'

export const runtime = 'nodejs'

const MAX_IMAGEN_BYTES = 4 * 1024 * 1024

/**
 * Consulta cargada desde el formulario web. Se convierte en un mensaje del
 * vendedor y entra por el mismo camino que WhatsApp: el agente extrae, el
 * sistema califica y la respuesta vuelve al vendedor por WhatsApp si hay número.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    vendedor_nombre?: string; vendedor_phone?: string
    nombre_cliente?: string; dni?: string; banco?: string; monto?: string; telefono_cliente?: string
    imagen?: { mime: string; data: string }
  } | null
  if (!body) return NextResponse.json({ error: 'cuerpo inválido' }, { status: 400 })

  const vendedorPhone = body.vendedor_phone?.replace(/\D/g, '') || VENDEDORES[1].phone
  const vendedorNombre = body.vendedor_nombre?.trim() || null
  const imagen = body.imagen && /^image\/(jpeg|png|gif|webp)$/.test(body.imagen.mime) ? body.imagen : null
  if (imagen && imagen.data.length * 0.75 > MAX_IMAGEN_BYTES) return NextResponse.json({ error: 'La foto supera los 4 MB' }, { status: 413 })

  const partes = [
    body.nombre_cliente?.trim() && `Cliente: ${body.nombre_cliente.trim()}`,
    body.dni?.replace(/\D/g, '') && `DNI: ${body.dni.replace(/\D/g, '')}`,
    body.banco?.trim() && `Cobra en: ${body.banco.trim()}`,
    body.monto?.replace(/\D/g, '') && `Monto pedido: $${Number(body.monto.replace(/\D/g, '')).toLocaleString('es-AR')}`,
    body.telefono_cliente?.replace(/\D/g, '') && `Teléfono del cliente: ${body.telefono_cliente.replace(/\D/g, '')}`,
  ].filter(Boolean)
  if (partes.length === 0 && !imagen) return NextResponse.json({ error: 'Cargá al menos un dato o la foto del DNI' }, { status: 400 })

  const text = `Te paso una consulta nueva por el formulario.\n${partes.join('\n')}${imagen ? '\n(Adjunto la foto del DNI.)' : ''}`
  try {
    const { contact, reply, consulta } = await procesarEntrante({ phone: vendedorPhone, text, name: vendedorNombre, imagen })
    let envio = 'WhatsApp no configurado: la respuesta quedó en el hilo.'
    if (whatsappConfigurado()) {
      const r = await enviarTexto(contact.phone, reply.body)
      envio = r.ok ? `Respuesta enviada por WhatsApp a +${contact.phone}.` : `No se pudo enviar por WhatsApp (${r.error?.slice(0, 80)}). Quedó en el hilo.`
    }
    return NextResponse.json({ reply: reply.body, consulta, contact, envio })
  } catch (err) {
    console.error('[consulta] error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error' }, { status: 500 })
  }
}
