import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tareas: Array<() => Promise<void>> = []
vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => Promise<void>) => { tareas.push(fn) },
}))

const procesarEntrante = vi.fn(async (input: { phone: string }) => ({ contact: { phone: input.phone }, reply: { body: 'respuesta' }, consulta: null }))
vi.mock('@/lib/pipeline', () => ({ procesarEntrante }))

const yaGuardados = new Set<string>()
vi.mock('@/lib/db', () => ({ db: () => ({ hasWaMessage: async (id: string) => yaGuardados.has(id) }) }))

const enviarTexto = vi.fn(async () => ({ ok: true }))
vi.mock('@/lib/whatsapp', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/whatsapp')>()),
  enviarTexto,
  marcarLeido: vi.fn(async () => undefined),
  descargarMedia: vi.fn(async () => ({ mime: 'image/jpeg', data: 'AAAA' })),
}))

const { GET, POST } = await import('@/app/api/whatsapp/webhook/route')

const URL_WEBHOOK = 'https://demo.test/api/whatsapp/webhook'
const cuerpo = (id = 'wamid.1', extra: Record<string, unknown> = { type: 'text', text: { body: 'hola' } }) =>
  JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '5491100000001', profile: { name: 'Lucía' } }], messages: [{ id, from: '5491100000001', timestamp: '1', ...extra }] } }] }] })
const firmar = (body: string, secret = 'app-secret') => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
const post = (body: string, headers: Record<string, string> = {}) => POST(new Request(URL_WEBHOOK, { method: 'POST', body, headers }))
const correrTareas = async () => { while (tareas.length) await tareas.shift()!() }

afterEach(() => {
  vi.unstubAllEnvs()
  tareas.length = 0
  yaGuardados.clear()
  procesarEntrante.mockClear()
  enviarTexto.mockClear()
})

describe('GET (Meta verification handshake)', () => {
  it('echoes the challenge only with the right token', async () => {
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'tok')
    const ok = await GET(new Request(`${URL_WEBHOOK}?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=42`))
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe('42')
    const bad = await GET(new Request(`${URL_WEBHOOK}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`))
    expect(bad.status).toBe(403)
  })

  it('refuses when no token is configured, even if the request sends an empty one', async () => {
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '')
    const r = await GET(new Request(`${URL_WEBHOOK}?hub.mode=subscribe&hub.verify_token=&hub.challenge=42`))
    expect(r.status).toBe(403)
  })
})

describe('POST (incoming messages)', () => {
  // Without a secret the route skips signature checks; tests that need one set it explicitly.
  // Clearing it here keeps the suite independent of the environment (CI defines a dummy secret).
  beforeEach(() => {
    vi.stubEnv('WHATSAPP_APP_SECRET', '')
  })

  it('with an app secret configured, rejects unsigned or badly signed requests', async () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 'app-secret')
    expect((await post(cuerpo())).status).toBe(401)
    expect((await post(cuerpo(), { 'x-hub-signature-256': firmar(cuerpo(), 'otro') })).status).toBe(401)
    expect(tareas).toHaveLength(0)
  })

  it('processes a correctly signed message after answering 200', async () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 'app-secret')
    const body = cuerpo()
    const r = await post(body, { 'x-hub-signature-256': firmar(body) })
    expect(r.status).toBe(200)
    expect(procesarEntrante).not.toHaveBeenCalled() // todavía no: corre en after()
    await correrTareas()
    expect(procesarEntrante).toHaveBeenCalledWith(expect.objectContaining({ phone: '5491100000001', text: 'hola', name: 'Lucía', waId: 'wamid.1' }))
    expect(enviarTexto).toHaveBeenCalledWith('5491100000001', 'respuesta')
  })

  it('answers 400 to a body that is not JSON', async () => {
    expect((await post('{nope')).status).toBe(400)
  })

  it('drops a payload with an unexpected shape but still answers 200 so Meta stops retrying', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const r = await post(JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 1 }] } }] }] }))
    expect(r.status).toBe(200)
    expect(tareas).toHaveLength(0)
  })

  it('a retry of an already stored message is not processed again', async () => {
    yaGuardados.add('wamid.1')
    await post(cuerpo())
    await correrTareas()
    expect(procesarEntrante).not.toHaveBeenCalled()
  })

  it('a retry that arrives while the first delivery is still running is ignored', async () => {
    await post(cuerpo('wamid.2'))
    await post(cuerpo('wamid.2'))
    expect(tareas).toHaveLength(1)
    await correrTareas()
    expect(procesarEntrante).toHaveBeenCalledOnce()
  })

  it('downloads an incoming photo and passes it to the pipeline', async () => {
    await post(cuerpo('wamid.3', { type: 'image', image: { id: 'media1', mime_type: 'image/jpeg', caption: 'DNI' } }))
    await correrTareas()
    expect(procesarEntrante).toHaveBeenCalledWith(expect.objectContaining({ text: 'DNI', imagen: { mime: 'image/jpeg', data: 'AAAA' } }))
  })

  it('an error in one message does not stop the rest of the batch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    procesarEntrante.mockImplementationOnce(async () => { throw new Error('boom') })
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [
      { id: 'a', from: '5491100000001', timestamp: '1', type: 'text', text: { body: 'uno' } },
      { id: 'b', from: '5491100000002', timestamp: '1', type: 'text', text: { body: 'dos' } },
    ] } }] }] })
    await post(body)
    await correrTareas()
    expect(enviarTexto).toHaveBeenCalledOnce()
    expect(enviarTexto).toHaveBeenCalledWith('5491100000002', 'respuesta')
  })
})
