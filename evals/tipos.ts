import type { SalidaAgente } from '../src/lib/agent/agent'
import type { Contact, Consulta } from '../src/lib/types'

/** Lo que tiene que pasar al final de la conversación. */
export type Resultado = 'califica' | 'no_califica' | 'pide_datos' | 'deriva_humano'

export type SalidaGrabada = Omit<Partial<SalidaAgente>, 'datos' | 'consulta'> & {
  datos?: Partial<SalidaAgente['datos']>
  consulta?: Partial<NonNullable<SalidaAgente['consulta']>> | null
}

export interface Caso {
  id: string
  descripcion: string
  telefono: string
  /** Mensajes del usuario, en orden. */
  mensajes: string[]
  esperado: Resultado
  /**
   * Salidas del modelo para el modo offline, en el orden en que el pipeline
   * las pide (un turno que completa una consulta de vendedor pide dos).
   */
  grabadas: SalidaGrabada[]
}

/** Traduce el estado final del CRM a una de las cuatro categorías. */
export function clasificarResultado(contact: Contact, consulta: Consulta | null): Resultado {
  if (contact.tipo === 'vendedor') {
    if (!consulta || !consulta.completa) return 'pide_datos'
    if (consulta.stage === 'verificacion' || consulta.stage === 'seguimiento') return 'califica'
    if (consulta.stage === 'rechazado') return 'no_califica'
    return 'deriva_humano' // score intermedio: lo mira un analista
  }
  switch (contact.stage) {
    case 'cobranza': return 'deriva_humano'
    case 'rechazado': return 'no_califica'
    case 'nuevo': return 'pide_datos'
    case 'verificacion':
      return /revisi[oó]n manual|analista|verificador lo revise/i.test(contact.proximo_paso ?? '') ? 'deriva_humano' : 'califica'
    case 'seguimiento': return 'califica'
  }
}
