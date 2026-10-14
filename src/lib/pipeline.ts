import { db, type Store } from './db'
import { responder as responderConClaude, type ContextoAgente, type SalidaAgente } from './agent/agent'
import { notaResultado } from './agent/prompt'
import { calcularScore, calcularScoreConsulta, consultarBureau, etapaPorScore, montoSugerido, formatoARS } from './scoring'
import { ETAPA_LABEL, VENDEDORES } from './negocio'
import type { Contact, Message, Media, Consulta } from './types'

export interface Entrada {
  phone: string
  text: string
  name?: string | null
  waId?: string | null
  /** Foto adjunta (base64 sin prefijo). */
  imagen?: { mime: string; data: string } | null
}

export interface Resultado { contact: Contact; reply: Message; consulta: Consulta | null }

/** Colaboradores externos del pipeline. Se inyectan en tests y evals. */
export interface Dependencias {
  store: Store
  responder: (ctx: ContextoAgente) => Promise<SalidaAgente>
  bureau: typeof consultarBureau
}

/**
 * Camino único para todo mensaje entrante, venga de WhatsApp o del simulador:
 * guarda el mensaje (y la foto), corre el agente, actualiza la ficha o la
 * consulta, y guarda la respuesta. El envío por WhatsApp lo hace quien llama.
 */
export async function procesarEntrante(input: Entrada, deps: Partial<Dependencias> = {}): Promise<Resultado> {
  const store = deps.store ?? db()
  const responder = deps.responder ?? ((ctx: ContextoAgente) => responderConClaude(ctx))
  const bureau = deps.bureau ?? consultarBureau
  const vendedorConocido = VENDEDORES.find(v => v.phone === input.phone)
  let contact = await store.getContactByPhone(input.phone)
  if (!contact) {
    contact = vendedorConocido
      ? await store.updateContact((await store.createContact(input.phone, vendedorConocido.nombre, 'vendedor', vendedorConocido.sucursal)).id, { stage: 'seguimiento' })
      : await store.createContact(input.phone, input.name)
  }
  if (!contact.name && input.name) contact = await store.updateContact(contact.id, { name: input.name })

  let mediaNueva: Media | null = null
  if (input.imagen) mediaNueva = await store.addMedia({ contact_id: contact.id, mime: input.imagen.mime, data: input.imagen.data })
  await store.addMessage({
    contact_id: contact.id,
    direction: 'in',
    kind: mediaNueva ? 'imagen' : 'text',
    body: input.text || (mediaNueva ? '[foto]' : ''),
    wa_id: input.waId ?? null,
    media_id: mediaNueva?.id ?? null,
  })

  const history = await store.listMessages(contact.id)
  const media = new Map<string, Media>()
  for (const m of history) if (m.media_id) { const md = await store.getMedia(m.media_id); if (md) media.set(m.media_id, md) }

  let consulta = contact.tipo === 'vendedor' ? await store.getConsultaActiva(contact.id) : null
  let out = await responder({ contact, history, consulta, media })

  /* ── Vendedor: la consulta es la entidad que se califica ── */
  if (out.rol === 'vendedor' && out.consulta) {
    if (contact.tipo !== 'vendedor') {
      contact = await store.updateContact(contact.id, { tipo: 'vendedor', stage: 'seguimiento' })
      await store.addMessage({ contact_id: contact.id, direction: 'out', kind: 'sistema', body: 'Reconocido como vendedor' })
    }
    const dniDistinto = Boolean(out.consulta.dni && consulta?.dni && out.consulta.dni !== consulta.dni)
    if (!consulta || out.consulta.consulta_nueva || dniDistinto) consulta = await store.createConsulta(contact.id)

    const patch: Partial<Consulta> = {
      nombre_cliente: out.consulta.nombre_cliente ?? consulta.nombre_cliente,
      dni: out.consulta.dni ?? consulta.dni,
      banco: out.consulta.banco ?? consulta.banco,
      monto: out.consulta.monto ?? consulta.monto,
      telefono_cliente: out.consulta.telefono_cliente ?? consulta.telefono_cliente,
      fotos: mediaNueva ? [...consulta.fotos, mediaNueva.id] : consulta.fotos,
      resumen: out.resumen,
      proximo_paso: out.proximo_paso,
    }
    const parcial = { ...consulta, ...patch }
    const reciénCompleta = calcularScoreConsulta(parcial).completa && !consulta.bureau
    if (reciénCompleta) {
      // Califica el sistema, no la IA. Después el agente redacta el resultado.
      parcial.bureau = bureau(parcial.dni!)
      const { score } = calcularScoreConsulta(parcial)
      Object.assign(patch, { bureau: parcial.bureau, score, completa: true, stage: etapaPorScore(score) })
      consulta = await store.updateConsulta(consulta.id, patch)
      await store.addMessage({ contact_id: contact.id, direction: 'out', kind: 'sistema', body: `Consulta de ${consulta.nombre_cliente} calificada: ${score}/100 · ${ETAPA_LABEL[consulta.stage]}${score >= 60 ? ` · hasta ${formatoARS(montoSugerido(consulta.bureau))}` : ''}` })
      out = await responder({ contact, history, consulta, media, nota: notaResultado(consulta) })
      consulta = await store.updateConsulta(consulta.id, { resumen: out.resumen, proximo_paso: out.proximo_paso })
    } else {
      consulta = await store.updateConsulta(consulta.id, patch)
    }
    contact = await store.updateContact(contact.id, { resumen: out.resumen, proximo_paso: out.proximo_paso })
    const reply = await store.addMessage({ contact_id: contact.id, direction: 'out', body: out.reply })
    return { contact, reply, consulta }
  }

  /* ── Cliente final ── */
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
  return { contact, reply, consulta: null }
}
