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

export type TipoContacto = 'cliente' | 'vendedor'

export interface Contact {
  id: string
  phone: string
  name: string | null
  tipo: TipoContacto
  sucursal: string | null
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
export type MessageKind = 'text' | 'imagen' | 'recordatorio' | 'agradecimiento' | 'sistema'

export interface Message {
  id: string
  contact_id: string
  direction: Direction
  kind: MessageKind
  body: string
  wa_id: string | null
  media_id: string | null
  created_at: string
}

/** Foto o documento recibido por WhatsApp (o subido en el simulador). */
export interface Media {
  id: string
  contact_id: string
  mime: string
  /** base64 sin prefijo */
  data: string
  created_at: string
}

/** Resultado simulado de la consulta crediticia por DNI. */
export interface Bureau {
  situacion: 1 | 2 | 3 | 4 | 5
  deuda_total: number
  detalle: string
}

/** Consulta que un vendedor manda en nombre de un cliente. */
export interface Consulta {
  id: string
  vendedor_id: string
  nombre_cliente: string | null
  dni: string | null
  banco: string | null
  monto: number | null
  telefono_cliente: string | null
  completa: boolean
  bureau: Bureau | null
  score: number
  stage: Etapa
  resumen: string | null
  proximo_paso: string | null
  fotos: string[]
  created_at: string
  updated_at: string
}
