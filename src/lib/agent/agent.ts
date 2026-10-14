import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { SYSTEM_PROMPT, estadoContacto } from './prompt'
import { aplicarGuardas } from './guardas'
import { ETAPAS } from '../negocio'
import type { Contact, Message, Datos, Consulta, Media } from '../types'

/** Modelo por defecto; se puede cambiar sin tocar código con CLAUDE_MODEL. */
export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5'
/** Cuántas fotos recientes se le muestran al modelo. */
const MAX_FOTOS = 4

export const Salida = z.object({
  reply: z.string().describe('Texto exacto que se manda por WhatsApp. Corto, una pregunta como máximo.'),
  rol: z.enum(['cliente', 'vendedor']),
  datos: z.object({
    nombre: z.string().nullable(),
    monto_solicitado: z.number().nullable().describe('En pesos, número entero'),
    destino: z.string().nullable(),
    situacion_laboral: z.enum(['relacion_dependencia', 'monotributista', 'jubilado', 'informal', 'desempleado', 'desconocida']).nullable(),
    ingresos_mensuales: z.number().nullable().describe('En pesos, número entero'),
    edad: z.number().nullable(),
    provincia: z.string().nullable(),
    turno_verificacion: z.string().nullable().describe('Día y franja acordados para la llamada, en texto'),
    es_cliente_con_cuota: z.boolean().nullable(),
  }).describe('Datos del cliente final. Si el rol es vendedor, dejá todo en null.'),
  consulta: z.object({
    nombre_cliente: z.string().nullable().describe('Apellido y nombre del cliente por el que consulta el vendedor'),
    dni: z.string().nullable().describe('Solo dígitos'),
    banco: z.string().nullable().describe('Banco donde cobra el cliente'),
    monto: z.number().nullable(),
    telefono_cliente: z.string().nullable().describe('Solo dígitos, con código de país si se puede'),
    consulta_nueva: z.boolean().describe('true si estos datos son de otra persona distinta a la consulta en curso'),
  }).nullable().describe('Solo si el rol es vendedor; null si es cliente.'),
  stage: z.enum(ETAPAS),
  resumen: z.string().describe('Una oración para el operador: quién es, qué pide, en qué quedó'),
  proximo_paso: z.string().describe('Acción concreta siguiente, para el operador'),
})

export type SalidaAgente = z.infer<typeof Salida>

type MediaMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const esImagen = (mime: string): mime is MediaMime => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)

export interface ContextoAgente {
  contact: Contact
  history: Message[]
  consulta: Consulta | null
  /** Media referenciada por los mensajes, por id. */
  media: Map<string, Media>
  /** Nota final del sistema (por ejemplo, resultado de la calificación recién corrida). */
  nota?: string
}

/** Lo que se le pide al modelo: el prompt fijo y el hilo armado. */
export interface SolicitudModelo { system: string; messages: Anthropic.MessageParam[] }
/** Respuesta mínima que el agente necesita del modelo. */
export interface RespuestaModelo { stop_reason: string | null; parsed_output: SalidaAgente | null }
/**
 * Frontera con el LLM. En producción es Claude; en tests y evals se reemplaza
 * por un doble que devuelve salidas grabadas, sin red ni costo.
 */
export type Modelo = (req: SolicitudModelo) => Promise<RespuestaModelo>

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

/** Implementación real: salida estructurada validada contra el esquema zod. */
export const modeloClaude: Modelo = async ({ system, messages }) => {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'medium', format: zodOutputFormat(Salida) },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
  })
  return { stop_reason: response.stop_reason, parsed_output: response.parsed_output ?? null }
}

/**
 * Arma el hilo para el modelo: une turnos consecutivos del mismo rol, adjunta
 * solo las últimas fotos como imagen y deja el estado volátil al final del
 * último turno del usuario, para que el prefijo (system + historial) se cachee.
 */
export function construirMensajes(ctx: ContextoAgente, ahora: Date = new Date()): Anthropic.MessageParam[] {
  const { contact, history, consulta, media } = ctx
  const messages: Anthropic.MessageParam[] = []
  const idsFotos = history
    .filter(m => m.media_id && media.get(m.media_id) && esImagen(media.get(m.media_id)!.mime))
    .map(m => m.media_id!)
  const fotosVisibles = new Set(idsFotos.slice(-MAX_FOTOS))

  for (const m of history) {
    if (m.kind === 'sistema') continue
    const role = m.direction === 'in' ? 'user' : 'assistant'
    const bloques: Anthropic.ContentBlockParam[] = []
    if (m.media_id && fotosVisibles.has(m.media_id)) {
      const md = media.get(m.media_id)!
      bloques.push({ type: 'image', source: { type: 'base64', media_type: md.mime as MediaMime, data: md.data } })
    }
    bloques.push({ type: 'text', text: m.body })
    const last = messages[messages.length - 1]
    if (last && last.role === role && Array.isArray(last.content)) {
      last.content.push(...bloques)
    } else {
      messages.push({ role, content: bloques })
    }
  }
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: [{ type: 'text', text: '(inicio de conversación)' }] })
  }
  const estado = [estadoContacto(contact, consulta, ahora), ctx.nota].filter(Boolean).join('\n\n')
  const last = messages[messages.length - 1]
  if (last.role === 'user' && Array.isArray(last.content)) {
    last.content.push({ type: 'text', text: estado })
  } else {
    messages.push({ role: 'user', content: [{ type: 'text', text: estado }] })
  }
  return messages
}

/** Respuesta segura cuando el modelo se niega o no devuelve una salida válida: no toca la ficha. */
export function salidaDeRespaldo(contact: Contact): SalidaAgente {
  return {
    reply: 'Perdón, no pude procesar ese mensaje. ¿Me lo repetís con otras palabras?',
    rol: contact.tipo,
    datos: normalizar(contact.datos),
    consulta: null,
    stage: contact.stage,
    resumen: contact.resumen ?? 'Sin resumen',
    proximo_paso: contact.proximo_paso ?? 'Revisar conversación',
  }
}

/**
 * Combina la salida del modelo con lo que ya se sabía del contacto:
 * null en la salida significa "no cambió", nunca "borrar". DNI y teléfono quedan en dígitos.
 */
export function fusionarSalida(out: SalidaAgente, contact: Contact): SalidaAgente {
  const fusionada: SalidaAgente = {
    ...out,
    datos: { ...normalizar(contact.datos), ...sinNulos(out.datos) } as SalidaAgente['datos'],
  }
  if (out.consulta) {
    fusionada.consulta = {
      ...out.consulta,
      dni: out.consulta.dni?.replace(/\D/g, '') || null,
      telefono_cliente: out.consulta.telefono_cliente?.replace(/\D/g, '') || null,
    }
  }
  return fusionada
}

/**
 * Genera la respuesta del agente para el último mensaje entrante.
 * `history` es el hilo completo, ordenado, incluido el mensaje nuevo.
 * El modelo propone; `fusionarSalida` y `aplicarGuardas` deciden qué se guarda.
 */
export async function responder(ctx: ContextoAgente, modelo: Modelo = modeloClaude): Promise<SalidaAgente> {
  const response = await modelo({ system: SYSTEM_PROMPT, messages: construirMensajes(ctx) })
  if (response.stop_reason === 'refusal' || !response.parsed_output) return salidaDeRespaldo(ctx.contact)
  const { salida, correcciones } = aplicarGuardas(fusionarSalida(response.parsed_output, ctx.contact))
  if (correcciones.length) console.warn('[agente] guardas aplicadas:', correcciones.join('; '))
  return salida
}

function normalizar(d: Datos): SalidaAgente['datos'] {
  return {
    nombre: d.nombre ?? null,
    monto_solicitado: d.monto_solicitado ?? null,
    destino: d.destino ?? null,
    situacion_laboral: d.situacion_laboral ?? null,
    ingresos_mensuales: d.ingresos_mensuales ?? null,
    edad: d.edad ?? null,
    provincia: d.provincia ?? null,
    turno_verificacion: d.turno_verificacion ?? null,
    es_cliente_con_cuota: d.es_cliente_con_cuota ?? null,
  }
}

function sinNulos<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '')) as Partial<T>
}
