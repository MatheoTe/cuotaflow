/**
 * Embudo de cobranzas. Vive aparte del de originación: otra tabla, otras
 * etapas y (en producción) otra línea de WhatsApp.
 */
export const ETAPAS_COBRANZA = ['por_vencer', 'mora_temprana', 'contactado', 'promesa', 'regularizado', 'mora_tardia'] as const
export type EtapaCobranza = (typeof ETAPAS_COBRANZA)[number]

export const ETAPA_COBRANZA_LABEL: Record<EtapaCobranza, string> = {
  por_vencer: 'Por vencer',
  mora_temprana: 'Mora 1–30 días',
  contactado: 'Contactado',
  promesa: 'Promesa de pago',
  regularizado: 'Regularizado',
  mora_tardia: 'Mora +60 días',
}

export const ETAPA_COBRANZA_AYUDA: Record<EtapaCobranza, string> = {
  por_vencer: 'Vence en los próximos 7 días',
  mora_temprana: 'Sin contacto todavía',
  contactado: 'Hablamos, sin compromiso',
  promesa: 'Se comprometió a pagar',
  regularizado: 'Pagó lo vencido',
  mora_tardia: 'Gestión intensiva o legal',
}

export const OPERADORES = ['Lucía Ferraro', 'Diego Sosa', 'Carla Méndez'] as const

export type CanalGestion = 'whatsapp' | 'llamada' | 'plantilla' | 'sistema'
export type ResultadoGestion = 'sin_respuesta' | 'contactado' | 'promesa' | 'pago' | 'recordatorio' | 'cambio_etapa'

export interface Gestion {
  fecha: string
  canal: CanalGestion
  resultado: ResultadoGestion
  operador: string
  nota: string
  monto?: number | null
}

export interface Cuenta {
  id: string
  nombre: string
  dni: string | null
  telefono: string | null
  nro_credito: string
  producto: string
  cuota: number
  cuotas_pagas: number
  cuotas_total: number
  cuotas_vencidas: number
  saldo_vencido: number
  dias_mora: number
  vencimiento: string | null
  stage: EtapaCobranza
  operador: string | null
  promesa_fecha: string | null
  promesa_monto: number | null
  recuperado: number
  gestiones: Gestion[]
  created_at: string
  updated_at: string
}

