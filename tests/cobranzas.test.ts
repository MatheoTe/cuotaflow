import { describe, expect, it } from 'vitest'
import { OPERADORES, rendimientoOperadores, type Cuenta, type Gestion } from '@/lib/cobranzas'

const [LUCIA, DIEGO] = OPERADORES
const g = (operador: string, resultado: Gestion['resultado'], canal: Gestion['canal'] = 'llamada'): Gestion => ({ fecha: '', canal, resultado, operador, nota: '' })
let i = 0
const cuenta = (over: Partial<Cuenta>): Cuenta => ({
  id: `k${++i}`, nombre: 'x', dni: null, telefono: null, nro_credito: 'MH-1', producto: 'Préstamo personal', cuota: 100, cuotas_pagas: 0,
  cuotas_total: 12, cuotas_vencidas: 1, saldo_vencido: 100, dias_mora: 10, vencimiento: null, stage: 'mora_temprana', operador: LUCIA,
  promesa_fecha: null, promesa_monto: null, recuperado: 0, gestiones: [], created_at: '', updated_at: '', ...over,
})

describe('rendimientoOperadores', () => {
  const cartera = [
    cuenta({ gestiones: [g(LUCIA, 'sin_respuesta'), g(LUCIA, 'contactado')] }),
    cuenta({ stage: 'promesa', gestiones: [g(LUCIA, 'promesa')] }),
    cuenta({ stage: 'regularizado', recuperado: 97_000, gestiones: [g(LUCIA, 'promesa'), g('Sistema', 'pago', 'sistema')] }),
    cuenta({ stage: 'mora_tardia', gestiones: [g(LUCIA, 'sin_respuesta')] }),
    cuenta({ stage: 'por_vencer', gestiones: [g('Sistema', 'recordatorio', 'plantilla')] }),
    cuenta({ operador: DIEGO, stage: 'regularizado', recuperado: 61_000, gestiones: [g(DIEGO, 'contactado')] }),
  ]
  const porOperador = Object.fromEntries(rendimientoOperadores(cartera).map(r => [r.operador, r]))

  it('returns one row per operator, even without accounts', () => {
    expect(Object.keys(porOperador)).toEqual([...OPERADORES])
    expect(porOperador[OPERADORES[2]]).toMatchObject({ asignadas: 0, contactabilidad: 0, recupero: 0 })
  })

  it('counts only human actions by that operator, not automatic ones', () => {
    expect(porOperador[LUCIA].gestiones).toBe(5)
  })

  it('contact rate is over overdue accounts only (accounts not yet due are excluded)', () => {
    // 4 cuentas en mora; contactadas: contactado, promesa, promesa → 3/4
    expect(porOperador[LUCIA]).toMatchObject({ asignadas: 5, contactabilidad: 75 })
  })

  it('a kept promise is a settled account that had a promise', () => {
    expect(porOperador[LUCIA]).toMatchObject({ promesas: 2, cumplidas: 1, recupero: 97_000 })
    expect(porOperador[DIEGO]).toMatchObject({ cumplidas: 0, recupero: 61_000 })
  })
})
