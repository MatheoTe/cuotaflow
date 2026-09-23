'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ETAPAS, ETAPA_LABEL, PLANTILLAS, type Etapa } from '@/lib/negocio'
import { enviarTexto, whatsappConfigurado } from '@/lib/whatsapp'
import { formatoARS } from '@/lib/scoring'
import { cobranzas, ETAPAS_COBRANZA, ETAPA_COBRANZA_LABEL, type EtapaCobranza, type Gestion } from '@/lib/cobranzas'

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

/* ── Borrado (para resetear la demo) ── */

export async function borrarContacto(id: string) {
  await db().deleteContact(id)
  revalidatePath('/'); revalidatePath('/tablero'); revalidatePath('/conversaciones')
  redirect('/tablero')
}

export async function borrarConsulta(id: string) {
  await db().deleteConsulta(id)
  revalidatePath('/'); revalidatePath('/tablero')
  redirect('/tablero')
}

/* ── Embudo de cobranzas ── */


function refrescarCobranza(id: string) {
  revalidatePath('/tablero')
  revalidatePath(`/cobranzas/${id}`)
}

export async function cambiarEtapaCobranza(id: string, stage: string) {
  if (!ETAPAS_COBRANZA.includes(stage as EtapaCobranza)) throw new Error('etapa inválida')
  const s = cobranzas()
  const c = await s.get(id)
  if (!c || c.stage === stage) return
  const g: Gestion = { fecha: new Date().toISOString(), canal: 'sistema', resultado: 'cambio_etapa', operador: c.operador ?? 'Operador', nota: `Pasó de ${ETAPA_COBRANZA_LABEL[c.stage]} a ${ETAPA_COBRANZA_LABEL[stage as EtapaCobranza]}` }
  await s.update(id, { stage: stage as EtapaCobranza, gestiones: [...c.gestiones, g] })
  refrescarCobranza(id)
}

export async function registrarGestion(id: string, formData: FormData): Promise<{ ok: boolean; detalle: string }> {
  const s = cobranzas()
  const c = await s.get(id)
  if (!c) throw new Error('cuenta no existe')
  const canal = String(formData.get('canal') ?? 'llamada') as Gestion['canal']
  const resultado = String(formData.get('resultado') ?? 'contactado') as Gestion['resultado']
  const nota = String(formData.get('nota') ?? '').trim() || 'Gestión registrada'
  const monto = Number(String(formData.get('monto') ?? '').replace(/\D/g, '')) || null
  const promesaFecha = String(formData.get('promesa_fecha') ?? '') || null
  const g: Gestion = { fecha: new Date().toISOString(), canal, resultado, operador: c.operador ?? 'Operador', nota, monto }
  const patch: Parameters<typeof s.update>[1] = { gestiones: [...c.gestiones, g] }
  if (resultado === 'contactado' && (c.stage === 'mora_temprana' || c.stage === 'mora_tardia')) patch.stage = 'contactado'
  if (resultado === 'promesa') Object.assign(patch, { stage: 'promesa', promesa_fecha: promesaFecha, promesa_monto: monto ?? c.saldo_vencido })
  if (resultado === 'pago') Object.assign(patch, { stage: 'regularizado', recuperado: c.recuperado + (monto ?? c.saldo_vencido), saldo_vencido: 0, cuotas_vencidas: 0, dias_mora: 0, cuotas_pagas: c.cuotas_pagas + c.cuotas_vencidas, promesa_fecha: null, promesa_monto: null })
  await s.update(id, patch)
  refrescarCobranza(id)
  return { ok: true, detalle: 'Gestión registrada en el historial.' }
}

export async function enviarRecordatorioCobranza(id: string): Promise<{ ok: boolean; detalle: string }> {
  const s = cobranzas()
  const c = await s.get(id)
  if (!c) throw new Error('cuenta no existe')
  const nota = c.dias_mora > 0
    ? `Plantilla de deuda: ${c.cuotas_vencidas} cuota(s) vencida(s) por ${formatoARS(c.saldo_vencido)}, con medios de pago y botón de baja`
    : `Plantilla de recordatorio: cuota de ${formatoARS(c.cuota)} vence el ${c.vencimiento ?? 'próximo vencimiento'}`
  const g: Gestion = { fecha: new Date().toISOString(), canal: 'plantilla', resultado: 'recordatorio', operador: 'Sistema', nota }
  await s.update(id, { gestiones: [...c.gestiones, g] })
  refrescarCobranza(id)
  return { ok: true, detalle: 'Plantilla registrada. Con la línea de cobranzas conectada sale por WhatsApp como plantilla aprobada por Meta.' }
}
