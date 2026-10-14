import type { SalidaAgente } from '@/lib/agent/agent'
import type { Contact, Consulta, Message } from '@/lib/types'

const T0 = '2026-10-01T12:00:00.000Z'

export function contacto(over: Partial<Contact> = {}): Contact {
  return {
    id: 'c1', phone: '5491100000001', name: null, tipo: 'cliente', sucursal: null, stage: 'nuevo', score: 0,
    datos: {}, resumen: null, proximo_paso: null, vencimiento: null, cuota: null,
    created_at: T0, updated_at: T0, last_message_at: null, ...over,
  }
}

export function consulta(over: Partial<Consulta> = {}): Consulta {
  return {
    id: 'q1', vendedor_id: 'v1', nombre_cliente: null, dni: null, banco: null, monto: null, telefono_cliente: null,
    completa: false, bureau: null, score: 0, stage: 'nuevo', resumen: null, proximo_paso: null, fotos: [],
    created_at: T0, updated_at: T0, ...over,
  }
}

let n = 0
export function mensaje(direction: 'in' | 'out', body: string, over: Partial<Message> = {}): Message {
  n += 1
  return { id: `m${n}`, contact_id: 'c1', direction, kind: 'text', body, wa_id: null, media_id: null, created_at: new Date(Date.parse(T0) + n * 1000).toISOString(), ...over }
}

const DATOS_VACIOS: SalidaAgente['datos'] = {
  nombre: null, monto_solicitado: null, destino: null, situacion_laboral: null, ingresos_mensuales: null,
  edad: null, provincia: null, turno_verificacion: null, es_cliente_con_cuota: null,
}

/** Salida del modelo con valores por defecto neutros. */
export function salida(over: Omit<Partial<SalidaAgente>, 'datos'> & { datos?: Partial<SalidaAgente['datos']> } = {}): SalidaAgente {
  const { datos, ...resto } = over
  return {
    reply: 'ok', rol: 'cliente', consulta: null, stage: 'nuevo', resumen: 'resumen', proximo_paso: 'paso',
    ...resto,
    datos: { ...DATOS_VACIOS, ...datos },
  }
}
