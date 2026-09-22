'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { ETAPAS, ETAPA_LABEL, PLANTILLAS, type Etapa } from '@/lib/negocio'
import { enviarTexto, whatsappConfigurado } from '@/lib/whatsapp'
import { formatoARS } from '@/lib/scoring'

function refrescar(id: string, tipo: 'contactos' | 'consultas' = 'contactos') {
  revalidatePath('/tablero')
  revalidatePath('/conversaciones')
  revalidatePath(`/${tipo}/${id}`)
}

export async function cambiarEtapa(id: string, stage: string) {
  if (!ETAPAS.includes(stage as Etapa)) throw new Error('etapa inválida')
  const store = db()
  const c = await store.getContact(id)
  if (!c) throw new Error('contacto no existe')
  if (c.stage === stage) return
  await store.updateContact(id, { stage: stage as Etapa })
  await store.addMessage({ contact_id: id, direction: 'out', kind: 'sistema', body: `Operador: pasó de ${ETAPA_LABEL[c.stage]} a ${ETAPA_LABEL[stage as Etapa]}` })
  refrescar(id)
}

export async function guardarCuota(id: string, formData: FormData) {
  const cuota = Number(String(formData.get('cuota') ?? '').replace(/\D/g, '')) || null
  const vencimiento = String(formData.get('vencimiento') ?? '') || null
  await db().updateContact(id, { cuota, vencimiento })
  refrescar(id)
}

export async function enviarRecordatorio(id: string): Promise<{ ok: boolean; detalle: string }> {
  const store = db()
  const c = await store.getContact(id)
  if (!c) throw new Error('contacto no existe')
  const fecha = c.vencimiento ? new Date(`${c.vencimiento}T12:00:00`).toLocaleDateString('es-AR') : 'próximo vencimiento'
  const body = PLANTILLAS.recordatorio_vencimiento(c.name ?? 'cliente', fecha, formatoARS(c.cuota))
  return despachar(c.id, c.phone, body, 'recordatorio')
}

export async function enviarAgradecimiento(id: string): Promise<{ ok: boolean; detalle: string }> {
  const store = db()
  const c = await store.getContact(id)
  if (!c) throw new Error('contacto no existe')
  const body = PLANTILLAS.agradecimiento_pago(c.name ?? 'cliente')
  return despachar(c.id, c.phone, body, 'agradecimiento')
}

/* ── Consultas de vendedor ── */

export async function cambiarEtapaConsulta(id: string, stage: string) {
  if (!ETAPAS.includes(stage as Etapa)) throw new Error('etapa inválida')
  const store = db()
  const c = await store.getConsulta(id)
  if (!c) throw new Error('consulta no existe')
  if (c.stage === stage) return
  await store.updateConsulta(id, { stage: stage as Etapa })
  await store.addMessage({ contact_id: c.vendedor_id, direction: 'out', kind: 'sistema', body: `Operador: consulta de ${c.nombre_cliente ?? 'cliente'} pasó de ${ETAPA_LABEL[c.stage]} a ${ETAPA_LABEL[stage as Etapa]}` })
  refrescar(id, 'consultas')
}

export async function avisarVendedor(id: string, tipo: 'aprobada' | 'falta_documentacion'): Promise<{ ok: boolean; detalle: string }> {
  const store = db()
  const c = await store.getConsulta(id)
  if (!c) throw new Error('consulta no existe')
  const v = await store.getContact(c.vendedor_id)
  if (!v) throw new Error('vendedor no existe')
  const cliente = c.nombre_cliente ?? 'el cliente'
  const body = tipo === 'aprobada'
    ? `${v.name ? v.name.split(' ')[0] + ', ' : ''}te confirmo: el crédito de ${cliente}${c.dni ? ` (DNI ${c.dni})` : ''} quedó aprobado. Ya podés avisarle; el desembolso se coordina desde acá.`
    : `${v.name ? v.name.split(' ')[0] + ', ' : ''}para avanzar con ${cliente}${c.dni ? ` (DNI ${c.dni})` : ''} nos falta documentación: mandame por acá la foto del DNI (frente y dorso) y el último recibo de haberes.`
  if (tipo === 'aprobada') await store.updateConsulta(id, { stage: 'seguimiento', proximo_paso: 'Coordinar desembolso' })
  const r = await despachar(v.id, v.phone, body, 'text')
  refrescar(id, 'consultas')
  return r
}

async function despachar(id: string, phone: string, body: string, kind: 'recordatorio' | 'agradecimiento' | 'text') {
  await db().addMessage({ contact_id: id, direction: 'out', kind, body })
  let detalle = 'Registrado en el hilo (WhatsApp no configurado: no se envió).'
  if (whatsappConfigurado()) {
    const r = await enviarTexto(phone, body)
    detalle = r.ok ? 'Enviado por WhatsApp.' : `No se pudo enviar: ${r.error}`
  }
  refrescar(id)
  return { ok: true, detalle }
}
