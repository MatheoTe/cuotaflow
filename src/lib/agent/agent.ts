import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { SYSTEM_PROMPT, estadoContacto } from './prompt'
import { ETAPAS } from '../negocio'
import type { Contact, Message, Datos } from '../types'

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-5'

const Salida = z.object({
  reply: z.string().describe('Texto exacto que se manda por WhatsApp. Corto, una pregunta como máximo.'),
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
  }),
  stage: z.enum(ETAPAS),
  resumen: z.string().describe('Una oración para el operador: quién es, qué pide, en qué quedó'),
  proximo_paso: z.string().describe('Acción concreta siguiente, para el operador'),
})

export type SalidaAgente = z.infer<typeof Salida>

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

/**
 * Genera la respuesta del agente para el último mensaje entrante.
 * `history` es el hilo completo, ordenado, incluido el mensaje nuevo.
 */
export async function responder(contact: Contact, history: Message[]): Promise<SalidaAgente> {
  const messages: Anthropic.MessageParam[] = []
  for (const m of history) {
    if (m.kind === 'sistema') continue
    const role = m.direction === 'in' ? 'user' : 'assistant'
    const last = messages[messages.length - 1]
    if (last && last.role === role && typeof last.content === 'string') {
      last.content = `${last.content}\n${m.body}`
    } else {
      messages.push({ role, content: m.body })
    }
  }
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: '(inicio de conversación)' })
  }
  // El estado volátil va al final, en el turno del usuario, así el prefijo se cachea.
  const last = messages[messages.length - 1]
  if (last.role === 'user' && typeof last.content === 'string') {
    last.content = `${last.content}\n\n${estadoContacto(contact, new Date())}`
  } else {
    messages.push({ role: 'user', content: estadoContacto(contact, new Date()) })
  }

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'medium', format: zodOutputFormat(Salida) },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  })

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    return {
      reply: 'Perdón, no pude procesar ese mensaje. ¿Me lo repetís con otras palabras?',
      datos: normalizar(contact.datos),
      stage: contact.stage,
      resumen: contact.resumen ?? 'Sin resumen',
      proximo_paso: contact.proximo_paso ?? 'Revisar conversación',
    }
  }
  const out = response.parsed_output
  // Los datos nuevos nunca borran los viejos: null en la salida = "no cambió".
  out.datos = { ...normalizar(contact.datos), ...sinNulos(out.datos) } as SalidaAgente['datos']
  return out
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
