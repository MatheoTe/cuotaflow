import { describe, expect, it } from 'vitest'
import { aplicarGuardas } from '@/lib/agent/guardas'
import { salida } from './factories'

const seisDatos = { nombre: 'Tomás', monto_solicitado: 2_000_000, destino: 'viaje', situacion_laboral: 'desempleado' as const, ingresos_mensuales: 250_000, edad: 19 }

describe('aplicarGuardas', () => {
  it('leaves a well-formed output untouched', () => {
    const s = salida({ stage: 'rechazado', datos: seisDatos })
    expect(aplicarGuardas(s)).toEqual({ salida: s, correcciones: [] })
  })

  it.each(['verificacion', 'rechazado'] as const)('blocks a %s verdict before the data is complete', stage => {
    const { salida: out, correcciones } = aplicarGuardas(salida({ stage, datos: { ...seisDatos, edad: null } }))
    expect(out.stage).toBe('nuevo')
    expect(correcciones[0]).toMatch(/datos incompletos/)
  })

  it('sends a client with an existing installment to collections', () => {
    const { salida: out } = aplicarGuardas(salida({ stage: 'nuevo', datos: { es_cliente_con_cuota: true } }))
    expect(out.stage).toBe('cobranza')
  })

  it('does not treat a collections case as a premature verdict', () => {
    const { salida: out, correcciones } = aplicarGuardas(salida({ stage: 'verificacion', datos: { es_cliente_con_cuota: true } }))
    expect(out.stage).toBe('verificacion')
    expect(correcciones).toEqual([])
  })

  it('keeps sellers in follow-up: they are never scored themselves', () => {
    const { salida: out } = aplicarGuardas(salida({ rol: 'vendedor', stage: 'verificacion' }))
    expect(out.stage).toBe('seguimiento')
  })

  it('drops a third-party request attached to an end client', () => {
    const { salida: out } = aplicarGuardas(salida({ rol: 'cliente', consulta: { nombre_cliente: 'X', dni: '1', banco: 'B', monto: null, telefono_cliente: null, consulta_nueva: false } }))
    expect(out.consulta).toBeNull()
  })

  it('does not mutate its input', () => {
    const s = salida({ rol: 'vendedor', stage: 'nuevo' })
    aplicarGuardas(s)
    expect(s.stage).toBe('nuevo')
  })
})
