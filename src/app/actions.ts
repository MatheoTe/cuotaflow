'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { ETAPAS, ETAPA_LABEL, PLANTILLAS, type Etapa } from '@/lib/negocio'
import { enviarTexto, whatsappConfigurado } from '@/lib/whatsapp'
import { formatoARS } from '@/lib/scoring'

function refrescar(id: string) {
  revalidatePath('/tablero')
  revalidatePath('/conversaciones')
  revalidatePath(`/contactos/${id}`)
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

async function despachar(id: string, phone: string, body: string, kind: 'recordatorio' | 'agradecimiento') {
  await db().addMessage({ contact_id: id, direction: 'out', kind, body })
  let detalle = 'Registrado en el hilo (WhatsApp no configurado: no se envió).'
  if (whatsappConfigurado()) {
    const r = await enviarTexto(phone, body)
    detalle = r.ok ? 'Enviado por WhatsApp.' : `No se pudo enviar: ${r.error}`
  }
  refrescar(id)
  return { ok: true, detalle }
}
