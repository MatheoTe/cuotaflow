import { calcularScore } from '../scoring'
import type { SalidaAgente } from './agent'

/**
 * Guardas deterministas sobre la salida del modelo. El prompt pide estas reglas,
 * pero un LLM puede saltarlas; el código las garantiza antes de tocar la ficha.
 * Devuelve la salida corregida y qué se corrigió, para dejarlo en el log.
 */
export function aplicarGuardas(salida: SalidaAgente): { salida: SalidaAgente; correcciones: string[] } {
  const correcciones: string[] = []
  const out: SalidaAgente = { ...salida }

  if (out.rol === 'vendedor') {
    // El vendedor no se califica: sus consultas tienen su propia etapa.
    if (out.stage !== 'seguimiento') {
      correcciones.push(`vendedor en etapa ${out.stage} → seguimiento`)
      out.stage = 'seguimiento'
    }
    return { salida: out, correcciones }
  }

  // Un cliente final no manda consultas de terceros.
  if (out.consulta) {
    correcciones.push('cliente con consulta de vendedor → se descarta la consulta')
    out.consulta = null
  }

  const conCuota = out.datos.es_cliente_con_cuota === true
  if (conCuota && out.stage === 'nuevo') {
    correcciones.push('cliente con cuota en etapa nuevo → cobranza')
    out.stage = 'cobranza'
  }

  // Sin los seis datos no hay veredicto: ni verificación ni rechazo.
  const { completo } = calcularScore(out.datos)
  if (!conCuota && !completo && (out.stage === 'verificacion' || out.stage === 'rechazado')) {
    correcciones.push(`veredicto (${out.stage}) con datos incompletos → nuevo`)
    out.stage = 'nuevo'
  }

  return { salida: out, correcciones }
}
