import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '@/lib/db'
import { procesarEntrante } from '@/lib/pipeline'
import { responder } from '@/lib/agent/agent'
import { crearModeloDemo, extraerDni, extraerMonto } from '@/lib/agent/modelo-demo'
import { salidaDeRespaldo } from '@/lib/agent/agent'
import { VENDEDORES } from '@/lib/negocio'
import { GOLDEN } from '../evals/golden'
import { clasificarResultado } from '../evals/tipos'
import { evaluarRespuesta } from '../evals/rubrica'
import { contacto } from './factories'

/** Mismo camino que el simulador en modo demo: pipeline real + modelo offline. */
const demo = (store: MemoryStore) => ({ store, responder: (ctx: Parameters<typeof crearModeloDemo>[0]) => responder(ctx, crearModeloDemo(ctx)) })
const RESPALDO = salidaDeRespaldo(contacto()).reply

async function conversar(store: MemoryStore, phone: string, mensajes: Array<string | { text: string; imagen: { mime: string; data: string } }>, name?: string) {
  const replies: string[] = []
  let ultimo: Awaited<ReturnType<typeof procesarEntrante>> | null = null
  for (const m of mensajes) {
    const entrada = typeof m === 'string' ? { phone, text: m, name } : { phone, name, ...m }
    ultimo = await procesarEntrante(entrada, demo(store))
    replies.push(ultimo.reply.body)
    expect(ultimo.reply.body).not.toBe(RESPALDO)
    expect(evaluarRespuesta(ultimo.reply.body, ultimo.contact.tipo)).toEqual([])
  }
  return { ultimo: ultimo!, replies }
}

describe('demo model: golden set', () => {
  // Las mismas conversaciones que los evals, sin salidas grabadas: el modelo de la demo
  // tiene que llegar al mismo resultado de negocio y respetar la rúbrica en cada respuesta.
  for (const caso of GOLDEN) {
    it(`${caso.id} → ${caso.esperado}`, async () => {
      const { ultimo } = await conversar(new MemoryStore(), caso.telefono, caso.mensajes)
      expect(clasificarResultado(ultimo.contact, ultimo.consulta)).toBe(caso.esperado)
    })
  }
})

describe('demo model: the script in docs/mensajes-demo.txt', () => {
  const guion = readFileSync(path.join(__dirname, '..', 'docs', 'mensajes-demo.txt'), 'utf8')
  const dni = { mime: 'image/png', data: readFileSync(path.join(__dirname, '..', 'public', 'demo', 'dni-ficticio.png')).toString('base64') }
  const enGuion = (lineas: string[]) => { for (const l of lineas) expect(guion).toContain(l) }

  it('seller: request, bank, phone, the fictional ID photo and a second request', async () => {
    const store = new MemoryStore()
    const v = VENDEDORES[1]
    const lineas = ['Hola Sofi, te paso una consulta. Cliente Gutierrez Pablo, DNI 40123456, quiere 500 mil', 'cobra en el Galicia', 'el tel es 11 0000 4433']
    enGuion([...lineas, 'te paso esta, cobra por el Santander', 'otra: Choque Daniel dni 30111222 Macro 900 mil'])

    const a = await conversar(store, v.phone, lineas, v.nombre)
    expect(a.replies[0]).toMatch(/banco/i)
    expect(a.replies[1]).toMatch(/pre-aprobado hasta \$\s?1\.500\.000/)
    expect(a.ultimo.consulta).toMatchObject({ nombre_cliente: 'Gutierrez Pablo', dni: '40123456', banco: 'Banco Galicia', monto: 500_000, telefono_cliente: '5491100004433', stage: 'verificacion' })

    const foto = await conversar(store, v.phone, [{ text: 'te paso esta, cobra por el Santander', imagen: dni }], v.nombre)
    expect(foto.replies[0]).toMatch(/Leí el DNI: Mariela Villalba, DNI 33444555/)
    expect(foto.ultimo.consulta).toMatchObject({ nombre_cliente: 'Villalba Mariela Soledad', dni: '33444555', banco: 'Banco Santander', completa: true })
    expect(foto.ultimo.consulta!.fotos).toHaveLength(1)

    const otra = await conversar(store, v.phone, ['otra: Choque Daniel dni 30111222 Macro 900 mil'], v.nombre)
    expect(otra.replies[0]).toMatch(/analista/)
    expect(await store.listConsultas()).toHaveLength(3)
  })

  it('an unknown photo is not invented: it asks for the data by text', async () => {
    const store = new MemoryStore()
    const { replies, ultimo } = await conversar(store, VENDEDORES[1].phone, [{ text: '', imagen: { mime: 'image/png', data: 'AAAA' } }])
    expect(replies[0]).toMatch(/por texto/)
    expect(ultimo.consulta?.dni ?? null).toBeNull()
  })

  it('end client: qualifies, books the verification call and closes', async () => {
    const lineas = ['hola, necesito plata', 'Gonzalo', 'unos 800 mil, para terminar una obra en casa', 'soy monotributista', 'gano como 1 palo y medio por mes', '41', 'el jueves a la tarde me viene bien', 'gracias!']
    enGuion(lineas)
    const { ultimo, replies } = await conversar(new MemoryStore(), '5491100000201', lineas)
    expect(ultimo.contact).toMatchObject({ stage: 'verificacion', name: 'Gonzalo' })
    expect(ultimo.contact.datos).toMatchObject({ monto_solicitado: 800_000, situacion_laboral: 'monotributista', ingresos_mensuales: 1_500_000, edad: 41, turno_verificacion: 'el jueves a la tarde' })
    expect(replies[5]).toMatch(/pre-aprobado/)
    expect(replies[6]).toMatch(/jueves a la tarde/)
  })

  it('collections: routes to the collections team and answers how to pay', async () => {
    const lineas = ['hola soy Carla, tengo un préstamo con ustedes y no me llegó el link para pagar la cuota', 'como hago para pagar?']
    enGuion(lineas)
    const { ultimo, replies } = await conversar(new MemoryStore(), '5491100000301', lineas)
    expect(ultimo.contact.stage).toBe('cobranza')
    expect(replies[1]).toMatch(/HORIZONTE\.PAGOS/)
  })

  it('a seller who switches to writing as a client starts a fresh client thread', async () => {
    const store = new MemoryStore()
    const v = VENDEDORES[0]
    await conversar(store, v.phone, ['te paso otra: Ramírez Hugo, DNI 27314825, cobra en Banco Macro, quiere 700 mil'])
    const { ultimo, replies } = await conversar(store, v.phone, ['ahora escribo como cliente: hola, quiero un préstamo de 2 millones', 'Tomás', 'para un viaje', 'no tengo trabajo ahora, cobro un plan', 'como 250 mil', '19', 'que tasa tienen?'])
    expect(replies[1]).toMatch(/monto|para qué/i)
    expect(ultimo.contact.stage).toBe('rechazado')
    expect(replies[6]).toMatch(/tasa/)
  })
})

describe('demo model: fallbacks', () => {
  it('asks again instead of guessing when it does not understand', async () => {
    const store = new MemoryStore()
    const { replies } = await conversar(store, '5491100000401', ['hola', 'asdf qwer zxcv uiop'])
    expect(replies[0]).toMatch(/Cómo te llamás/)
    expect(replies[1]).toMatch(/no te entendí/)
  })

  it('answers rates and "are you a bot" without inventing numbers', async () => {
    const store = new MemoryStore()
    const { replies } = await conversar(store, '5491100000402', ['que tasa tienen?', 'sos un bot?'])
    expect(replies[0]).toMatch(/verificador/)
    expect(replies[1]).toMatch(/asistente virtual/)
  })

  it('parses Argentine money slang', () => {
    expect(extraerMonto('unos 800 mil')).toBe(800_000)
    expect(extraerMonto('1 palo y medio')).toBe(1_500_000)
    expect(extraerMonto('cobro como 1.100.000')).toBe(1_100_000)
    expect(extraerMonto('250 lucas')).toBe(250_000)
    expect(extraerMonto('1.2 M')).toBe(1_200_000)
    expect(extraerMonto('medio millón')).toBe(500_000)
    expect(extraerMonto('como 250', { sinUnidadEsMil: true })).toBe(250_000)
    expect(extraerMonto('41')).toBeNull()
  })

  it('tells a DNI from an amount', () => {
    expect(extraerDni('DNI 40123456')).toBe('40123456')
    expect(extraerDni('dni: 33.444.555')).toBe('33444555')
    expect(extraerDni('cobro 1.100.000')).toBeNull()
    expect(extraerDni('quiere 1.200.000')).toBeNull()
  })
})
