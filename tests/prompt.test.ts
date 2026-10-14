import { describe, expect, it } from 'vitest'
import { SYSTEM_PROMPT, estadoContacto, notaResultado } from '@/lib/agent/prompt'
import { consultarBureau } from '@/lib/scoring'
import { contacto, consulta } from './factories'

const ahora = new Date('2026-10-14T15:00:00Z')

describe('SYSTEM_PROMPT', () => {
  it('is static, so it can be cached: no dates or per-contact data', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(SYSTEM_PROMPT).not.toMatch(/549\d{10}/)
  })

  it('is built from the business config', () => {
    expect(SYSTEM_PROMPT).toContain('30%')
    expect(SYSTEM_PROMPT).toMatch(/Préstamo personal: de \$\s?100\.000 a \$\s?3\.000\.000/)
  })
})

describe('estadoContacto', () => {
  it('for an end client includes the accumulated data and the system score', () => {
    const e = estadoContacto(contacto({ datos: { nombre: 'Ana', edad: 40 } }), null, ahora)
    expect(e).toContain('Datos acumulados: {"nombre":"Ana","edad":40}')
    expect(e).toMatch(/Score calculado por el sistema: \d+ \(Faltan datos/)
  })

  it('mentions the installment when the client has one', () => {
    expect(estadoContacto(contacto({ cuota: 85_000, vencimiento: '2026-09-28' }), null, ahora)).toMatch(/cuota de \$\s?85\.000 que vence el 2026-09-28/)
  })

  it('for a seller without an open request says a new one starts', () => {
    expect(estadoContacto(contacto({ tipo: 'vendedor', sucursal: 'Sucursal Norte' }), null, ahora)).toContain('No hay consulta en curso')
  })

  it('for a scored request hands the model the verdict instead of letting it decide', () => {
    const q = consulta({ nombre_cliente: 'Gutierrez Pablo', dni: '40123456', banco: 'Galicia', bureau: consultarBureau('40123456') })
    const e = estadoContacto(contacto({ tipo: 'vendedor' }), q, ahora)
    expect(e).toContain('RESULTADO DE LA CALIFICACIÓN')
    expect(e).toMatch(/Pre-aprobado hasta \$\s?1\.500\.000/)
  })

  it('for an unscored request says it is pending', () => {
    expect(estadoContacto(contacto({ tipo: 'vendedor' }), consulta({ dni: '1' }), ahora)).toContain('todavía no fue calificada')
  })
})

describe('notaResultado', () => {
  it.each([
    ['40123456', /Pre-aprobado hasta/],
    ['30111222', /Queda a revisión de un analista/],
    ['27314825', /No califica/],
  ])('DNI %s produces the right verdict', (dni, veredicto) => {
    const q = consulta({ nombre_cliente: 'X', dni, banco: 'Macro', monto: 900_000, bureau: consultarBureau(dni) })
    expect(notaResultado(q)).toMatch(veredicto)
  })
})
