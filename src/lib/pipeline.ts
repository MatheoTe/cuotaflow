import { db } from './db'
import { responder } from './agent/agent'
import { calcularScore } from './scoring'
import { ETAPA_LABEL } from './negocio'
import type { Contact, Message } from './types'

export interface Resultado { contact: Contact; reply: Message }

/**
 * Camino único para todo mensaje entrante, venga de WhatsApp o del simulador:
 * guarda el mensaje, corre el agente, actualiza la ficha y guarda la respuesta.
 * El envío por WhatsApp lo hace quien llama, si corresponde.
 */
export async function procesarEntrante(input: { phone: string; text: string; name?: string | null; waId?: string | null }): Promise<Resultado> {
  const store = db()
  let contact = (await store.getContactByPhone(input.phone)) ?? (await store.createContact(input.phone, input.name))
  if (!contact.name && input.name) contact = await store.updateContact(contact.id, { name: input.name })

  await store.addMessage({ contact_id: contact.id, direction: 'in', body: input.text, wa_id: input.waId ?? null })
  const history = await store.listMessages(contact.id)

  const out = await responder(contact, history)
  const { score } = calcularScore(out.datos)

  const etapaAnterior = contact.stage
  contact = await store.updateContact(contact.id, {
    name: out.datos.nombre ?? contact.name,
    datos: out.datos,
    score,
    stage: out.stage,
    resumen: out.resumen,
    proximo_paso: out.proximo_paso,
  })
  if (etapaAnterior !== out.stage) {
    await store.addMessage({ contact_id: contact.id, direction: 'out', kind: 'sistema', body: `Pasó de ${ETAPA_LABEL[etapaAnterior]} a ${ETAPA_LABEL[out.stage]}` })
  }
  const reply = await store.addMessage({ contact_id: contact.id, direction: 'out', body: out.reply })
  return { contact, reply }
}
