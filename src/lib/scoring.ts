import { NEGOCIO } from './negocio'
import type { Datos } from './types'

/**
 * Calificación determinística: el agente extrae los datos, el sistema puntúa.
 * Devuelve 0-100 y las razones, para mostrarlas en la ficha del CRM.
 */
export function calcularScore(d: Datos): { score: number; razones: string[]; completo: boolean } {
  const razones: string[] = []
  let score = 0

  const faltan: string[] = []
  if (!d.nombre) faltan.push('nombre')
  if (!d.monto_solicitado) faltan.push('monto')
  if (!d.situacion_laboral || d.situacion_laboral === 'desconocida') faltan.push('situación laboral')
  if (!d.ingresos_mensuales) faltan.push('ingresos')
  if (!d.edad) faltan.push('edad')
  const completo = faltan.length === 0
  if (!completo) razones.push(`Faltan datos: ${faltan.join(', ')}`)

  // Edad
  if (d.edad != null) {
    if (d.edad < 18) { razones.push('Menor de 18 años'); return { score: 0, razones, completo } }
    if (d.edad <= 70) { score += 15; razones.push('Edad dentro del rango') }
    else { score += 5; razones.push('Edad mayor a 70: requiere revisión') }
  }

  // Situación laboral
  switch (d.situacion_laboral) {
    case 'relacion_dependencia': score += 35; razones.push('Relación de dependencia'); break
    case 'jubilado': score += 30; razones.push('Jubilado con haber'); break
    case 'monotributista': score += 25; razones.push('Monotributista'); break
    case 'informal': score += 8; razones.push('Ingresos informales: difícil de demostrar'); break
    case 'desempleado': razones.push('Sin ingresos declarados'); break
    default: break
  }

  // Relación cuota / ingreso (asume 12 cuotas para estimar)
  if (d.monto_solicitado && d.ingresos_mensuales) {
    const cuotaEstimada = (d.monto_solicitado * 1.6) / 12
    const ratio = cuotaEstimada / d.ingresos_mensuales
    if (ratio <= NEGOCIO.relacionCuotaIngreso) { score += 40; razones.push('La cuota estimada entra en el ingreso') }
    else if (ratio <= NEGOCIO.relacionCuotaIngreso * 1.5) { score += 20; razones.push('Cuota ajustada al ingreso: conviene menos monto o más plazo') }
    else { score += 5; razones.push('El monto pedido es alto para el ingreso declarado') }
  }

  // Monto dentro de producto
  if (d.monto_solicitado) {
    const enRango = NEGOCIO.productos.some(p => d.monto_solicitado! >= p.montoMin && d.monto_solicitado! <= p.montoMax)
    if (enRango) { score += 10; razones.push('Monto dentro de los productos ofrecidos') }
    else razones.push('Monto fuera de rango de productos')
  }

  return { score: Math.max(0, Math.min(100, score)), razones, completo }
}

export function etiquetaScore(score: number): { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' } {
  if (score >= 70) return { label: 'Pre-aprobado', variant: 'success' }
  if (score >= 40) return { label: 'A revisar', variant: 'warning' }
  if (score > 0) return { label: 'Bajo', variant: 'destructive' }
  return { label: 'Sin calificar', variant: 'outline' }
}

export const formatoARS = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
