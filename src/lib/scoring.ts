import { NEGOCIO } from './negocio'
import type { Datos, Bureau, Consulta } from './types'

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

/* ───────────────────── Consultas de vendedor ───────────────────── */


/**
 * Bureau SIMULADO: devuelve una situación crediticia determinística a partir del
 * DNI, para que la demo se comporte igual cada vez. En producción acá va la
 * consulta real (BCRA / Veraz / el proveedor que use el negocio).
 */
export function consultarBureau(dni: string): Bureau {
  const digitos = dni.replace(/\D/g, '')
  const h = [...digitos].reduce((acc, ch, i) => (acc * 31 + ch.charCodeAt(0) * (i + 1)) % 1000, 7)
  const p = h % 100
  const situacion: Bureau['situacion'] = p < 60 ? 1 : p < 75 ? 2 : p < 87 ? 3 : p < 95 ? 4 : 5
  const deuda_total = situacion === 1 ? 0 : 50_000 + (h * 1_237) % 900_000
  const detalle = {
    1: 'Situación 1: normal. Sin atrasos en los últimos 24 meses.',
    2: 'Situación 2: riesgo bajo. Atrasos de hasta 90 días.',
    3: 'Situación 3: riesgo medio. Atrasos de 90 a 180 días.',
    4: 'Situación 4: riesgo alto. Atrasos de más de 180 días.',
    5: 'Situación 5: irrecuperable. Deuda en gestión judicial.',
  }[situacion]
  return { situacion, deuda_total, detalle }
}

/** Score de una consulta de vendedor: bureau + banco donde cobra + monto. */
export function calcularScoreConsulta(c: Pick<Consulta, 'bureau' | 'banco' | 'monto' | 'dni' | 'nombre_cliente'>): { score: number; razones: string[]; completa: boolean } {
  const razones: string[] = []
  const faltan: string[] = []
  if (!c.nombre_cliente) faltan.push('nombre y apellido')
  if (!c.dni) faltan.push('DNI')
  if (!c.banco) faltan.push('banco donde cobra')
  const completa = faltan.length === 0
  if (!completa) razones.push(`Faltan datos: ${faltan.join(', ')}`)

  let score = 0
  if (c.bureau) {
    const base = { 1: 70, 2: 45, 3: 20, 4: 5, 5: 0 }[c.bureau.situacion]
    score += base
    razones.push(c.bureau.detalle + (c.bureau.deuda_total ? ` Deuda informada: ${formatoARS(c.bureau.deuda_total)}.` : ''))
  }
  if (c.banco) { score += 20; razones.push(`Cobra por ${c.banco}: ingreso bancarizado`) }
  if (c.monto) {
    const enRango = NEGOCIO.productos.some(p => c.monto! >= p.montoMin && c.monto! <= p.montoMax)
    if (enRango) { score += 10; razones.push('Monto dentro de los productos ofrecidos') }
    else razones.push('Monto fuera de rango de productos')
  } else if (completa) {
    score += 10
  }
  return { score: Math.max(0, Math.min(100, score)), razones, completa }
}

export function etapaPorScore(score: number): 'verificacion' | 'nuevo' | 'rechazado' {
  if (score >= 60) return 'verificacion'
  if (score >= 40) return 'nuevo'
  return 'rechazado'
}

/** Monto máximo sugerido según situación, para que el agente tenga un número que decir. */
export function montoSugerido(b: Bureau | null): number | null {
  if (!b) return null
  return { 1: 1_500_000, 2: 800_000, 3: 300_000, 4: 0, 5: 0 }[b.situacion] || null
}
