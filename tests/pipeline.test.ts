import { describe, expect, it, vi } from 'vitest'
import { MemoryStore } from '@/lib/db'
import { procesarEntrante, type Dependencias } from '@/lib/pipeline'
import { VENDEDORES } from '@/lib/negocio'
import type { ContextoAgente, SalidaAgente } from '@/lib/agent/agent'
import { salida } from './factories'

/** Responder falso: devuelve las salidas en orden y guarda el contexto de cada llamada. */
function guion(...salidas: SalidaAgente[]) {
  const llamadas: ContextoAgente[] = []
  const responder = vi.fn(async (ctx: ContextoAgente) => {
    llamadas.push(ctx)
    const s = salidas.shift()
    if (!s) throw new Error('el guion se quedó sin salidas')
    return s
  })
  return { responder, llamadas }
}

const nuevo = () => new MemoryStore()

describe('procesarEntrante: end client', () => {
  it('creates the contact, stores both messages and updates the record', async () => {
    const store = nuevo()
    const { responder } = guion(salida({ reply: '¿Cómo te llamás?', datos: { monto_solicitado: 800_000 } }))
    const r = await procesarEntrante({ phone: '5491100000001', text: 'necesito 800 mil', name: 'Perfil WA' }, { store, responder })
    expect(r.contact).toMatchObject({ phone: '5491100000001', name: 'Perfil WA', stage: 'nuevo', datos: { monto_solicitado: 800_000 } })
    const hilo = await store.listMessages(r.contact.id)
    expect(hilo.map(m => [m.direction, m.body])).toEqual([['in', 'necesito 800 mil'], ['out', '¿Cómo te llamás?']])
    expect(r.reply.body).toBe('¿Cómo te llamás?')
  })

  it('computes the score in code from the extracted data', async () => {
    const store = nuevo()
    const datos = { nombre: 'Lucía', monto_solicitado: 600_000, situacion_laboral: 'relacion_dependencia' as const, ingresos_mensuales: 1_100_000, edad: 34 }
    const { responder } = guion(salida({ stage: 'verificacion', datos }))
    const r = await procesarEntrante({ phone: '5491100000001', text: '34' }, { store, responder })
    expect(r.contact.score).toBe(100)
    expect(r.contact.name).toBe('Lucía')
  })

  it('logs a stage change as an internal note the model never sees', async () => {
    const store = nuevo()
    const { responder } = guion(salida({ stage: 'cobranza', datos: { es_cliente_con_cuota: true } }), salida({ stage: 'cobranza' }))
    const r = await procesarEntrante({ phone: '5491100000002', text: 'no me llegó el link para pagar' }, { store, responder })
    const notas = (await store.listMessages(r.contact.id)).filter(m => m.kind === 'sistema')
    expect(notas.map(n => n.body)).toEqual(['Pasó de Nuevo a Cobranza'])
    await procesarEntrante({ phone: '5491100000002', text: 'gracias' }, { store, responder })
    expect((await store.listMessages(r.contact.id)).filter(m => m.kind === 'sistema')).toHaveLength(1)
  })

  it('passes the whole thread, including the new message, to the agent', async () => {
    const store = nuevo()
    const { responder, llamadas } = guion(salida(), salida())
    await procesarEntrante({ phone: '5491100000003', text: 'hola' }, { store, responder })
    await procesarEntrante({ phone: '5491100000003', text: 'Rodrigo' }, { store, responder })
    expect(llamadas[1].history.map(m => m.body)).toEqual(['hola', 'ok', 'Rodrigo'])
  })

  it('stores an attached photo and hands it to the agent', async () => {
    const store = nuevo()
    const { responder, llamadas } = guion(salida())
    await procesarEntrante({ phone: '5491100000004', text: '', imagen: { mime: 'image/png', data: 'AAAA' } }, { store, responder })
    const [ctx] = llamadas
    expect(ctx.history[0]).toMatchObject({ kind: 'imagen', body: '[foto]' })
    expect([...ctx.media.values()][0]).toMatchObject({ mime: 'image/png', data: 'AAAA' })
  })

  it('refuses to store the same WhatsApp message twice', async () => {
    const store = nuevo()
    const { responder } = guion(salida(), salida())
    await procesarEntrante({ phone: '5491100000005', text: 'hola', waId: 'wamid.X' }, { store, responder })
    await expect(procesarEntrante({ phone: '5491100000005', text: 'hola', waId: 'wamid.X' }, { store, responder })).rejects.toThrow('duplicado')
    expect(await store.hasWaMessage('wamid.X')).toBe(true)
  })
})

describe('procesarEntrante: seller requests', () => {
  const vendedor = VENDEDORES[0]
  const consultaDe = (c: Partial<NonNullable<SalidaAgente['consulta']>>) =>
    ({ nombre_cliente: null, dni: null, banco: null, monto: null, telefono_cliente: null, consulta_nueva: false, ...c })

  it('recognizes a known seller by phone and keeps the request open until it has name, DNI and bank', async () => {
    const store = nuevo()
    const bureau = vi.fn()
    const { responder } = guion(salida({ rol: 'vendedor', stage: 'seguimiento', reply: '¿En qué banco cobra?', consulta: consultaDe({ nombre_cliente: 'Gutierrez Pablo', dni: '40123456', monto: 500_000 }) }))
    const r = await procesarEntrante({ phone: vendedor.phone, text: 'te paso una: Gutierrez Pablo DNI 40123456' }, { store, responder, bureau })
    expect(r.contact).toMatchObject({ tipo: 'vendedor', sucursal: vendedor.sucursal, stage: 'seguimiento' })
    expect(r.consulta).toMatchObject({ nombre_cliente: 'Gutierrez Pablo', dni: '40123456', bureau: null, completa: false })
    expect(bureau).not.toHaveBeenCalled()
  })

  it('when the last field arrives, the system scores it and the agent writes the verdict', async () => {
    const store = nuevo()
    const { responder, llamadas } = guion(
      salida({ rol: 'vendedor', stage: 'seguimiento', consulta: consultaDe({ nombre_cliente: 'Gutierrez Pablo', dni: '40123456' }) }),
      salida({ rol: 'vendedor', stage: 'seguimiento', consulta: consultaDe({ banco: 'Banco Galicia' }), reply: 'borrador' }),
      salida({ rol: 'vendedor', stage: 'seguimiento', consulta: consultaDe({}), reply: 'Pre-aprobado hasta $1.500.000', resumen: 'pre-aprobado' }),
    )
    await procesarEntrante({ phone: vendedor.phone, text: 'Gutierrez Pablo 40123456' }, { store, responder })
    const r = await procesarEntrante({ phone: vendedor.phone, text: 'cobra en el Galicia' }, { store, responder })

    expect(r.consulta).toMatchObject({ banco: 'Banco Galicia', completa: true, score: 100, stage: 'verificacion', resumen: 'pre-aprobado', bureau: { situacion: 1 } })
    expect(r.reply.body).toBe('Pre-aprobado hasta $1.500.000')
    // La segunda pasada del agente recibe el resultado ya calculado.
    expect(llamadas[2].nota).toMatch(/acaba de ser calificada: score 100\/100/)
    const notas = (await store.listMessages(r.contact.id)).filter(m => m.kind === 'sistema').map(m => m.body)
    expect(notas).toContain('Consulta de Gutierrez Pablo calificada: 100/100 · Verificación · hasta $ 1.500.000'.replace('$ ', '$ '))
    // El borrador previo al veredicto nunca llega al vendedor.
    expect((await store.listMessages(r.contact.id)).some(m => m.body === 'borrador')).toBe(false)
  })

  it('scores only once: later messages update the same request without re-running the bureau', async () => {
    const store = nuevo()
    const bureau = vi.fn().mockReturnValue({ situacion: 3, deuda_total: 100_000, detalle: 'Situación 3' })
    const { responder } = guion(
      salida({ rol: 'vendedor', consulta: consultaDe({ nombre_cliente: 'Choque Daniel', dni: '30111222', banco: 'Macro' }) }),
      salida({ rol: 'vendedor', consulta: consultaDe({}) }),
      salida({ rol: 'vendedor', consulta: consultaDe({ telefono_cliente: '5491100004433' }) }),
    )
    await procesarEntrante({ phone: vendedor.phone, text: 'Choque Daniel 30111222 Macro' }, { store, responder, bureau })
    const r = await procesarEntrante({ phone: vendedor.phone, text: 'el tel es 11 0000 4433' }, { store, responder, bureau })
    expect(bureau).toHaveBeenCalledOnce()
    expect(r.consulta).toMatchObject({ telefono_cliente: '5491100004433', stage: 'nuevo' })
    expect(await store.listConsultas()).toHaveLength(1)
  })

  it('opens a new request when the model flags it or the DNI changes', async () => {
    const store = nuevo()
    const { responder } = guion(
      salida({ rol: 'vendedor', consulta: consultaDe({ nombre_cliente: 'A', dni: '11111111' }) }),
      salida({ rol: 'vendedor', consulta: consultaDe({ nombre_cliente: 'B', dni: '22222222' }) }),
      salida({ rol: 'vendedor', consulta: consultaDe({ nombre_cliente: 'C', consulta_nueva: true }) }),
    )
    for (const t of ['A 11111111', 'B 22222222', 'otra: C']) await procesarEntrante({ phone: vendedor.phone, text: t }, { store, responder, bureau: vi.fn() })
    expect((await store.listConsultas()).map(c => c.nombre_cliente).sort()).toEqual(['A', 'B', 'C'])
  })

  it('an unknown number that passes third-party data becomes a seller', async () => {
    const store = nuevo()
    const { responder } = guion(salida({ rol: 'vendedor', consulta: consultaDe({ nombre_cliente: 'Flores Marta' }) }))
    const r = await procesarEntrante({ phone: '5491100000999', text: 'para un cliente mío: Flores Marta' }, { store, responder })
    expect(r.contact).toMatchObject({ tipo: 'vendedor', stage: 'seguimiento' })
    expect((await store.listMessages(r.contact.id)).some(m => m.body === 'Reconocido como vendedor')).toBe(true)
  })

  it('attaches photos to the request', async () => {
    const store = nuevo()
    const { responder } = guion(salida({ rol: 'vendedor', consulta: consultaDe({ nombre_cliente: 'Villalba Mariela', dni: '33444555' }) }))
    const r = await procesarEntrante({ phone: vendedor.phone, text: 'te paso esta', imagen: { mime: 'image/png', data: 'AAAA' } }, { store, responder })
    expect(r.consulta!.fotos).toHaveLength(1)
  })
})

describe('procesarEntrante defaults', () => {
  it('uses the real responder only when none is injected', async () => {
    const deps: Partial<Dependencias> = { store: nuevo(), responder: guion(salida()).responder }
    await expect(procesarEntrante({ phone: '5491100000001', text: 'hola' }, deps)).resolves.toBeDefined()
  })
})
