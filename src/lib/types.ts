import type { Etapa } from './negocio'

export type SituacionLaboral =
  | 'relacion_dependencia'
  | 'monotributista'
  | 'jubilado'
  | 'informal'
  | 'desempleado'
  | 'desconocida'

/** Lo que el agente va extrayendo de la conversación. Todo opcional: se completa de a poco. */
export interface Datos {
  nombre?: string | null
  monto_solicitado?: number | null
  destino?: string | null
  situacion_laboral?: SituacionLaboral | null
  ingresos_mensuales?: number | null
  edad?: number | null
  dni?: string | null
  provincia?: string | null
  turno_verificacion?: string | null
  /** true si ya es cliente y escribe por una cuota o deuda */
  es_cliente_con_cuota?: boolean | null
}

export interface Contact {
  id: string
  phone: string
  name: string | null
  stage: Etapa
  score: number
  datos: Datos
  resumen: string | null
  proximo_paso: string | null
  vencimiento: string | null
  cuota: number | null
  created_at: string
  updated_at: string
  last_message_at: string | null
}

export type Direction = 'in' | 'out'
export type MessageKind = 'text' | 'recordatorio' | 'agradecimiento' | 'sistema'

export interface Message {
  id: string
  contact_id: string
  direction: Direction
  kind: MessageKind
  body: string
  wa_id: string | null
  created_at: string
}
