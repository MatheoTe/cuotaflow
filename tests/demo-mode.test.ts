import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El SDK se reemplaza por un espía: en modo demo no se tiene que ni construir el cliente.
const parse = vi.fn()
const construido = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { constructor() { construido() } messages = { parse } } }))

const { MemoryStore, db } = await import('@/lib/db')
const { cobranzas } = await import('@/lib/cobranzas')
const { procesarEntrante } = await import('@/lib/pipeline')
const { modeloClaude } = await import('@/lib/agent/agent')
const { enviarTexto, whatsappConfigurado } = await import('@/lib/whatsapp')
const webhook = await import('@/app/api/whatsapp/webhook/route')
const reset = await import('@/app/api/demo/reset/route')
const chat = await import('@/app/api/chat/route')
const { _limitadorDemo } = await import('@/lib/guardia-demo')
const { LIMITES_DEMO } = await import('@/lib/demo')

const BASE = 'https://demo.test'

beforeEach(() => {
  vi.stubEnv('DEMO_MODE', '1')
  _limitadorDemo.limpiar()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  parse.mockClear()
  construido.mockClear()
})

describe('demo mode: no model spend', () => {
  it('answers through the offline model and never builds the Anthropic client, even with a key set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-real-looking-key')
    const store = new MemoryStore()
    const r = await procesarEntrante({ phone: '5491100000777', text: 'hola, necesito plata' }, { store })
    expect(r.reply.body).toMatch(/Cómo te llamás/)
    expect(construido).not.toHaveBeenCalled()
    expect(parse).not.toHaveBeenCalled()
  })

  it('refuses to call Claude directly while DEMO_MODE is on', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-real-looking-key')
    await expect(modeloClaude({ system: 's', messages: [] })).rejects.toThrow(/DEMO_MODE/)
    expect(parse).not.toHaveBeenCalled()
  })
})

describe('demo mode: WhatsApp is off', () => {
  it('the webhook does not exist (GET handshake and POST)', async () => {
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'tok')
    const get = await webhook.GET(new Request(`${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=42`))
    expect(get.status).toBe(404)
    const post = await webhook.POST(new Request(`${BASE}/api/whatsapp/webhook`, { method: 'POST', body: '{}' }))
    expect(post.status).toBe(404)
  })

  it('outbound sends are refused even with credentials configured', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', 'token')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(whatsappConfigurado()).toBe(false)
    const r = await enviarTexto('5491100000001', 'hola')
    expect(r.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('demo mode: seeded in-memory store', () => {
  it('starts with the fictional seed, including the request read from the ID photo, and the collections portfolio', async () => {
    const store = db()
    expect(store).toBeInstanceOf(MemoryStore)
    expect((await store.listContacts()).length).toBeGreaterThanOrEqual(6)
    const conFoto = (await store.listConsultas()).find(c => c.dni === '33444555')
    expect(conFoto?.fotos).toHaveLength(1)
    expect(await store.getMedia(conFoto!.fotos[0])).toMatchObject({ mime: 'image/png' })
    expect((await cobranzas().list()).length).toBeGreaterThan(10)
  })
})

describe('demo mode: /api/demo/reset', () => {
  const pedir = (headers: Record<string, string> = {}) => reset.POST(new Request(`${BASE}/api/demo/reset`, { method: 'POST', headers }))

  it('does not exist outside demo mode', async () => {
    vi.stubEnv('DEMO_MODE', '')
    vi.stubEnv('DEMO_RESET_TOKEN', 'secreto')
    expect((await pedir({ 'x-demo-reset-token': 'secreto' })).status).toBe(404)
  })

  it('refuses without a configured token, with a wrong one, or with an empty one', async () => {
    vi.stubEnv('DEMO_RESET_TOKEN', '')
    vi.stubEnv('CRON_SECRET', '')
    expect((await pedir({ 'x-demo-reset-token': '' })).status).toBe(403)
    vi.stubEnv('DEMO_RESET_TOKEN', 'secreto')
    expect((await pedir()).status).toBe(403)
    expect((await pedir({ 'x-demo-reset-token': 'otro' })).status).toBe(403)
    expect((await pedir({ authorization: 'Bearer otro' })).status).toBe(403)
  })

  it('restores the seed with the right token (header or Vercel cron bearer)', async () => {
    vi.stubEnv('DEMO_RESET_TOKEN', 'secreto')
    vi.stubEnv('CRON_SECRET', 'cron')
    const store = db()
    const antes = (await store.listContacts()).length
    await procesarEntrante({ phone: '5491100000888', text: 'hola' }, { store })
    await store.deleteContact((await store.listContacts()).find(c => c.phone === '5491100000001')!.id)

    const r = await pedir({ 'x-demo-reset-token': 'secreto' })
    expect(r.status).toBe(200)
    expect(await store.getContactByPhone('5491100000888')).toBeNull()
    expect(await store.getContactByPhone('5491100000001')).not.toBeNull()
    expect((await store.listContacts()).length).toBe(antes)

    const cron = await reset.GET(new Request(`${BASE}/api/demo/reset`, { headers: { authorization: 'Bearer cron' } }))
    expect(cron.status).toBe(200)
  })
})

describe('demo mode: simulator abuse guard', () => {
  const enviar = (text: string, ip = '203.0.113.7') =>
    chat.POST(new Request(`${BASE}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` }, body: JSON.stringify({ phone: '5491100000999', text }) }))

  it('caps the message length', async () => {
    const r = await enviar('a'.repeat(LIMITES_DEMO.maxTexto + 1))
    expect(r.status).toBe(413)
  })

  it('rate-limits per IP and leaves other IPs alone', async () => {
    for (let i = 0; i < LIMITES_DEMO.porMinuto; i++) expect((await enviar('hola')).status).toBe(200)
    const bloqueado = await enviar('hola')
    expect(bloqueado.status).toBe(429)
    expect(bloqueado.headers.get('retry-after')).toBeTruthy()
    expect((await enviar('hola', '198.51.100.4')).status).toBe(200)
  })
})
