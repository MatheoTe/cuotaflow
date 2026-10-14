import { createHmac } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enviarTexto, extraerEntrantes, firmaValida, mismoSecreto, WebhookSchema } from '@/lib/whatsapp'

const mensaje = (m: Record<string, unknown>) => ({ id: 'wamid.1', from: '5491100000001', timestamp: '1', ...m })
const payload = (messages: unknown[], contacts = [{ wa_id: '5491100000001', profile: { name: 'Lucía' } }]) =>
  WebhookSchema.parse({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts, messages } }] }] })

describe('extraerEntrantes', () => {
  it('extracts text with the profile name', () => {
    expect(extraerEntrantes(payload([mensaje({ type: 'text', text: { body: 'hola' } })]))).toEqual([
      { waId: 'wamid.1', from: '5491100000001', name: 'Lucía', text: 'hola', mediaId: null, mime: null },
    ])
  })

  it('reads quick-reply buttons and interactive replies as text', () => {
    const out = extraerEntrantes(payload([
      mensaje({ id: 'a', type: 'button', button: { text: 'Sí' } }),
      mensaje({ id: 'b', type: 'interactive', interactive: { button_reply: { title: 'Pagar' } } }),
      mensaje({ id: 'c', type: 'interactive', interactive: { list_reply: { title: 'Cuota' } } }),
    ]))
    expect(out.map(e => e.text)).toEqual(['Sí', 'Pagar', 'Cuota'])
  })

  it('keeps photos (and images sent as documents) with their caption', () => {
    const out = extraerEntrantes(payload([
      mensaje({ id: 'a', type: 'image', image: { id: 'media1', mime_type: 'image/jpeg', caption: 'cobra por Santander' } }),
      mensaje({ id: 'b', type: 'document', document: { id: 'media2', mime_type: 'image/png' } }),
    ]))
    expect(out).toMatchObject([
      { text: 'cobra por Santander', mediaId: 'media1', mime: 'image/jpeg' },
      { text: '', mediaId: 'media2', mime: 'image/png' },
    ])
  })

  it('ignores what the agent cannot handle: audio, PDFs, reactions, empty text', () => {
    const out = extraerEntrantes(payload([
      mensaje({ id: 'a', type: 'audio' }),
      mensaje({ id: 'b', type: 'document', document: { id: 'x', mime_type: 'application/pdf' } }),
      mensaje({ id: 'c', type: 'reaction' }),
      mensaje({ id: 'd', type: 'text', text: { body: '' } }),
    ]))
    expect(out).toEqual([])
  })

  it('ignores status callbacks (no messages array)', () => {
    expect(extraerEntrantes(WebhookSchema.parse({ entry: [{ changes: [{ value: { statuses: [{ id: 'x' }] } }] }] }))).toEqual([])
  })

  it('falls back to a null name when the contact block is missing', () => {
    expect(extraerEntrantes(payload([mensaje({ type: 'text', text: { body: 'hola' } })], []))[0].name).toBeNull()
  })
})

describe('WebhookSchema', () => {
  it('rejects a message without a sender or with a non-numeric one', () => {
    expect(WebhookSchema.safeParse({ entry: [{ changes: [{ value: { messages: [{ id: 'x', type: 'text', timestamp: '1' }] } }] }] }).success).toBe(false)
    expect(WebhookSchema.safeParse({ entry: [{ changes: [{ value: { messages: [mensaje({ from: 'evil; drop', type: 'text' })] } }] }] }).success).toBe(false)
  })

  it('tolerates unknown fields Meta may add', () => {
    expect(WebhookSchema.safeParse({ entry: [{ id: '1', changes: [{ field: 'messages', value: { metadata: {}, messages: [mensaje({ type: 'text', text: { body: 'a' }, context: {} })] } }] }] }).success).toBe(true)
  })
})

describe('firmaValida (X-Hub-Signature-256)', () => {
  const secret = 'app-secret'
  const cuerpo = JSON.stringify({ entry: [] })
  const firma = (body: string, key = secret) => `sha256=${createHmac('sha256', key).update(body).digest('hex')}`

  it('accepts the HMAC of the raw body', () => expect(firmaValida(cuerpo, firma(cuerpo), secret)).toBe(true))
  it('rejects a tampered body', () => expect(firmaValida(cuerpo + ' ', firma(cuerpo), secret)).toBe(false))
  it('rejects a signature made with another secret', () => expect(firmaValida(cuerpo, firma(cuerpo, 'other'), secret)).toBe(false))
  it.each([null, '', 'sha1=abc', 'sha256=', 'sha256=zz'])('rejects malformed header %j', h => expect(firmaValida(cuerpo, h, secret)).toBe(false))
})

describe('mismoSecreto', () => {
  it.each([
    ['abc', 'abc', true], ['abc', 'abd', false], ['abc', 'abcd', false], [null, 'abc', false], ['', '', false], ['abc', undefined, false],
  ] as const)('%j vs %j → %j', (a, b, ok) => expect(mismoSecreto(a, b)).toBe(ok))
})

describe('enviarTexto', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  const responder = (status: number, body = '{}') => new Response(body, { status })

  it('does nothing without credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await enviarTexto('5491100000001', 'hola')).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries with the legacy Argentine "15" formats when Meta rejects the 549 number', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', 't')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responder(400, '{"error":{"code":131030}}'))
      .mockResolvedValueOnce(responder(400, '{"error":{"code":131030}}'))
      .mockResolvedValueOnce(responder(200))
    vi.stubGlobal('fetch', fetchMock)
    const r = await enviarTexto('5491100004433', 'hola')
    expect(r.ok).toBe(true)
    const destinos = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).to)
    // 549 + área 11 + número → 54 + área (3 dígitos primero) + 15 + resto
    expect(destinos).toEqual(['5491100004433', '54110150004433', '54111500004433'])
  })

  it('does not retry on other errors', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', 't')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockResolvedValue(responder(401, 'invalid token'))
    vi.stubGlobal('fetch', fetchMock)
    const r = await enviarTexto('5491100004433', 'hola')
    expect(r).toEqual({ ok: false, error: '401: invalid token' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
