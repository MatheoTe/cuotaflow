import { describe, expect, it } from 'vitest'
import { calcularScore, calcularScoreConsulta, consultarBureau, etapaPorScore, etiquetaScore, montoSugerido } from '@/lib/scoring'
import type { Datos } from '@/lib/types'

const completo: Datos = { nombre: 'Lucía', monto_solicitado: 600_000, situacion_laboral: 'relacion_dependencia', ingresos_mensuales: 1_100_000, edad: 34 }

describe('calcularScore (cliente final)', () => {
  it('a profile with every signal in its favour scores 100 and is complete', () => {
    const r = calcularScore(completo)
    expect(r).toMatchObject({ score: 100, completo: true })
    expect(r.razones).toContain('La cuota estimada entra en el ingreso')
  })

  it('lists exactly which fields are missing', () => {
    const r = calcularScore({ nombre: 'Rodrigo', monto_solicitado: 250_000 })
    expect(r.completo).toBe(false)
    expect(r.razones[0]).toBe('Faltan datos: situación laboral, ingresos, edad')
  })

  it('treats an "unknown" employment situation as missing', () => {
    expect(calcularScore({ ...completo, situacion_laboral: 'desconocida' }).completo).toBe(false)
  })

  it('zero income is an answer, not missing data', () => {
    const r = calcularScore({ ...completo, situacion_laboral: 'desempleado', ingresos_mensuales: 0 })
    expect(r.completo).toBe(true)
  })

  it('a minor is an automatic zero regardless of everything else', () => {
    const r = calcularScore({ ...completo, edad: 17 })
    expect(r.score).toBe(0)
    expect(r.razones).toContain('Menor de 18 años')
  })

  it('over 70 still scores but flags review', () => {
    const r = calcularScore({ ...completo, edad: 75 })
    expect(r.score).toBe(90)
    expect(r.razones).toContain('Edad mayor a 70: requiere revisión')
  })

  it.each([
    // cuota = monto * 1.6 / 12; umbral 30% del ingreso, "ajustada" hasta 45%
    ['fits', 1_000_000, 600_000, 40],
    ['tight', 1_000_000, 400_000, 20],
    ['too high', 1_000_000, 200_000, 5],
  ])('installment-to-income ratio: %s', (_, monto, ingreso, puntos) => {
    const base = calcularScore({ ...completo, monto_solicitado: monto, ingresos_mensuales: ingreso })
    expect(base.score).toBe(15 + 35 + puntos + 10)
  })

  it('amounts outside every product lose the product points', () => {
    const r = calcularScore({ ...completo, monto_solicitado: 10_000 })
    expect(r.razones).toContain('Monto fuera de rango de productos')
    expect(r.score).toBe(15 + 35 + 40)
  })

  it.each([
    ['relacion_dependencia', 35], ['jubilado', 30], ['monotributista', 25], ['informal', 8], ['desempleado', 0],
  ] as const)('employment %s weighs %i points', (situacion, puntos) => {
    const sinRatio = calcularScore({ nombre: 'x', edad: 30, situacion_laboral: situacion })
    expect(sinRatio.score).toBe(15 + puntos)
  })

  it('a typical informal earner asking too much does not reach the review threshold', () => {
    const r = calcularScore({ nombre: 'Brian', monto_solicitado: 1_500_000, situacion_laboral: 'informal', ingresos_mensuales: 300_000, edad: 22 })
    expect(r.score).toBeLessThan(40)
    expect(etiquetaScore(r.score).label).toBe('Bajo')
  })
})

describe('consultarBureau (simulated credit bureau)', () => {
  it('is deterministic per DNI and ignores formatting', () => {
    expect(consultarBureau('40.123.456')).toEqual(consultarBureau('40123456'))
  })

  it('situation 1 never carries debt; worse situations always do', () => {
    for (let i = 0; i < 400; i++) {
      const b = consultarBureau(String(20_000_000 + i * 7_919))
      if (b.situacion === 1) expect(b.deuda_total).toBe(0)
      else expect(b.deuda_total).toBeGreaterThanOrEqual(50_000)
      expect(b.detalle).toMatch(new RegExp(`^Situación ${b.situacion}:`))
    }
  })

  it('produces a realistic mix: mostly clean, some of every risk band', () => {
    const conteo = new Map<number, number>()
    for (let i = 0; i < 2_000; i++) {
      const s = consultarBureau(String(10_000_000 + i * 15_485)).situacion
      conteo.set(s, (conteo.get(s) ?? 0) + 1)
    }
    expect([...conteo.keys()].sort()).toEqual([1, 2, 3, 4, 5])
    expect(conteo.get(1)!).toBeGreaterThan(conteo.get(5)!)
  })

  it.each([
    ['40123456', 1], ['30111222', 3], ['22535806', 4], ['27314825', 5],
  ] as const)('the documented demo DNI %s lands in situation %i', (dni, situacion) => {
    expect(consultarBureau(dni).situacion).toBe(situacion)
  })
})

describe('calcularScoreConsulta (seller request)', () => {
  const base = { nombre_cliente: 'Gutierrez Pablo', dni: '40123456', banco: 'Banco Galicia', monto: 500_000 }

  it('requires name, DNI and bank; amount is optional', () => {
    expect(calcularScoreConsulta({ ...base, bureau: null, monto: null }).completa).toBe(true)
    const r = calcularScoreConsulta({ ...base, bureau: null, dni: null, banco: null })
    expect(r.completa).toBe(false)
    expect(r.razones[0]).toBe('Faltan datos: DNI, banco donde cobra')
  })

  it('clean bureau + banked income + amount in range = pre-approved', () => {
    const r = calcularScoreConsulta({ ...base, bureau: consultarBureau(base.dni) })
    expect(r.score).toBe(100)
    expect(etapaPorScore(r.score)).toBe('verificacion')
  })

  it('situation 3 goes to an analyst, 4 and 5 are rejected', () => {
    const s3 = calcularScoreConsulta({ ...base, dni: '30111222', bureau: consultarBureau('30111222') }).score
    const s4 = calcularScoreConsulta({ ...base, dni: '22535806', bureau: consultarBureau('22535806') }).score
    const s5 = calcularScoreConsulta({ ...base, dni: '27314825', bureau: consultarBureau('27314825') }).score
    expect(etapaPorScore(s3)).toBe('nuevo')
    expect(etapaPorScore(s4)).toBe('rechazado')
    expect(etapaPorScore(s5)).toBe('rechazado')
  })

  it('mentions the reported debt in the reasons', () => {
    const r = calcularScoreConsulta({ ...base, dni: '30111222', bureau: consultarBureau('30111222') })
    expect(r.razones.join(' ')).toMatch(/Deuda informada: \$\s?117\.334/)
  })
})

describe('thresholds and labels', () => {
  it.each([[100, 'verificacion'], [60, 'verificacion'], [59, 'nuevo'], [40, 'nuevo'], [39, 'rechazado'], [0, 'rechazado']] as const)(
    'etapaPorScore(%i) = %s', (score, etapa) => expect(etapaPorScore(score)).toBe(etapa))

  it.each([[70, 'Pre-aprobado'], [40, 'A revisar'], [1, 'Bajo'], [0, 'Sin calificar']] as const)(
    'etiquetaScore(%i) = %s', (score, label) => expect(etiquetaScore(score).label).toBe(label))

  it('suggested amount only exists for situations 1 to 3', () => {
    expect(montoSugerido(null)).toBeNull()
    expect(montoSugerido({ situacion: 1, deuda_total: 0, detalle: '' })).toBe(1_500_000)
    expect(montoSugerido({ situacion: 3, deuda_total: 1, detalle: '' })).toBe(300_000)
    expect(montoSugerido({ situacion: 4, deuda_total: 1, detalle: '' })).toBeNull()
  })
})
