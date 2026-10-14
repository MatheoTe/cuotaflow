import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import type { Media } from '@/lib/types'
import { contacto, consulta, mensaje, salida } from './factories'

// El SDK se reemplaza entero: ningún test sale a la red.
const parse = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { parse } } }))

const { construirMensajes, fusionarSalida, modeloClaude, responder, salidaDeRespaldo, MODEL } = await import('@/lib/agent/agent')
const { SYSTEM_PROMPT } = await import('@/lib/agent/prompt')

const texto = (m: Anthropic.MessageParam) => (m.content as Anthropic.ContentBlockParam[]).filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlockParam).text)
const foto = (id: string, mime = 'image/png'): Media => ({ id, contact_id: 'c1', mime, data: 'AAAA', created_at: '' })

describe('construirMensajes', () => {
  const ctx = (history = [mensaje('in', 'hola')], extra: Partial<Parameters<typeof construirMensajes>[0]> = {}) =>
    ({ contact: contacto(), history, consulta: null, media: new Map<string, Media>(), ...extra })

  it('maps directions to roles and merges consecutive turns of the same role', () => {
    const msgs = construirMensajes(ctx([mensaje('in', 'hola'), mensaje('in', 'necesito plata'), mensaje('out', '¿Cómo te llamás?'), mensaje('in', 'Lucía')]))
    expect(msgs.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(texto(msgs[0])).toEqual(['hola', 'necesito plata'])
  })

  it('never shows internal system notes to the model', () => {
    const msgs = construirMensajes(ctx([mensaje('in', 'hola'), mensaje('out', 'Pasó de Nuevo a Cobranza', { kind: 'sistema' }), mensaje('in', 'gracias')]))
    expect(msgs).toHaveLength(1)
    expect(texto(msgs[0]).join(' ')).not.toContain('Pasó de Nuevo')
  })

  it('starts with a user turn even when the business wrote first (e.g. a reminder)', () => {
    const msgs = construirMensajes(ctx([mensaje('out', 'Tu cuota vence el 28'), mensaje('in', 'ok')]))
    expect(msgs[0].role).toBe('user')
    expect(texto(msgs[0])).toEqual(['(inicio de conversación)'])
  })

  it('appends the volatile state at the very end so the prefix stays cacheable', () => {
    const msgs = construirMensajes(ctx(), new Date('2026-10-14T15:00:00Z'))
    const ultimo = texto(msgs[msgs.length - 1])
    expect(ultimo[0]).toBe('hola')
    expect(ultimo[1]).toMatch(/^\[Estado del sistema/)
    expect(ultimo[1]).toContain('Teléfono: 5491100000001')
  })

  it('adds the system note after the state', () => {
    const msgs = construirMensajes(ctx(undefined, { nota: '[Sistema] calificada' }))
    expect(texto(msgs[0]).at(-1)).toMatch(/calificada$/)
  })

  it('only the last four photos travel as images; non-image media never does', () => {
    const media = new Map<string, Media>()
    const history = []
    for (let i = 1; i <= 6; i++) {
      media.set(`f${i}`, foto(`f${i}`))
      history.push(mensaje('in', `[foto ${i}]`, { media_id: `f${i}` }))
    }
    media.set('pdf', foto('pdf', 'application/pdf'))
    history.push(mensaje('in', '[pdf]', { media_id: 'pdf' }))
    const [unico] = construirMensajes(ctx(history, { media }))
    const imagenes = (unico.content as Anthropic.ContentBlockParam[]).filter(b => b.type === 'image')
    expect(imagenes).toHaveLength(4)
    // Las fotos viejas quedan como texto, para que el modelo sepa que existieron.
    expect(texto(unico)).toContain('[foto 1]')
  })
})

describe('fusionarSalida', () => {
  it('a null from the model means "unchanged", never "erase"', () => {
    const c = contacto({ datos: { nombre: 'Lucía', monto_solicitado: 600_000 } })
    const out = fusionarSalida(salida({ datos: { edad: 34 } }), c)
    expect(out.datos).toMatchObject({ nombre: 'Lucía', monto_solicitado: 600_000, edad: 34 })
  })

  it('a corrected value replaces the old one', () => {
    const c = contacto({ datos: { monto_solicitado: 600_000 } })
    expect(fusionarSalida(salida({ datos: { monto_solicitado: 400_000 } }), c).datos.monto_solicitado).toBe(400_000)
  })

  it('normalizes DNI and phone to digits; empty becomes null', () => {
    const out = fusionarSalida(salida({ rol: 'vendedor', consulta: { nombre_cliente: 'X', dni: '40.123.456', banco: null, monto: null, telefono_cliente: '+54 9 11 0000-4433', consulta_nueva: false } }), contacto())
    expect(out.consulta).toMatchObject({ dni: '40123456', telefono_cliente: '5491100004433' })
    const vacio = fusionarSalida(salida({ rol: 'vendedor', consulta: { nombre_cliente: 'X', dni: '--', banco: null, monto: null, telefono_cliente: '', consulta_nueva: false } }), contacto())
    expect(vacio.consulta).toMatchObject({ dni: null, telefono_cliente: null })
  })

  it('does not mutate the model output', () => {
    const original = salida({ datos: { edad: 30 } })
    fusionarSalida(original, contacto({ datos: { nombre: 'A' } }))
    expect(original.datos.nombre).toBeNull()
  })
})

describe('responder', () => {
  const ctx = () => ({ contact: contacto({ stage: 'verificacion', resumen: 'r', proximo_paso: 'p', datos: { nombre: 'Lucía' } }), history: [mensaje('in', 'hola')], consulta: null, media: new Map() })

  it('sends the fixed system prompt and the built thread to the model', async () => {
    const modelo = vi.fn().mockResolvedValue({ stop_reason: 'end_turn', parsed_output: salida({ stage: 'verificacion', datos: { nombre: 'Lucía' } }) })
    await responder(ctx(), modelo)
    expect(modelo).toHaveBeenCalledOnce()
    const { system, messages } = modelo.mock.calls[0][0]
    expect(system).toBe(SYSTEM_PROMPT)
    expect(messages[0].role).toBe('user')
  })

  it.each([
    ['a refusal', { stop_reason: 'refusal', parsed_output: salida({ stage: 'rechazado' }) }],
    ['an unparseable output', { stop_reason: 'end_turn', parsed_output: null }],
  ])('on %s it answers safely and leaves the record untouched', async (_, respuesta) => {
    const c = ctx()
    const out = await responder(c, vi.fn().mockResolvedValue(respuesta))
    expect(out).toEqual(salidaDeRespaldo(c.contact))
    expect(out.stage).toBe('verificacion')
    expect(out.datos.nombre).toBe('Lucía')
  })

  it('runs the guardrails on what the model proposes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const premature = salida({ stage: 'rechazado', datos: { situacion_laboral: 'desempleado' } })
    const c = { ...ctx(), contact: contacto() }
    const out = await responder(c, vi.fn().mockResolvedValue({ stop_reason: 'end_turn', parsed_output: premature }))
    expect(out.stage).toBe('nuevo')
    expect(warn).toHaveBeenCalledWith('[agente] guardas aplicadas:', expect.stringContaining('datos incompletos'))
    warn.mockRestore()
  })
})

describe('modeloClaude (SDK adapter)', () => {

  it('uses structured output, medium effort and caches the system prompt', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: salida() })
    const r = await modeloClaude({ system: 'SYS', messages: [{ role: 'user', content: 'hola' }] })
    expect(r).toEqual({ stop_reason: 'end_turn', parsed_output: salida() })
    const req = parse.mock.lastCall![0]
    expect(req.model).toBe(MODEL)
    expect(req.output_config.effort).toBe('medium')
    expect(req.output_config.format).toBeDefined()
    expect(req.system).toEqual([{ type: 'text', text: 'SYS', cache_control: { type: 'ephemeral' } }])
  })

  it('defaults to the current Opus model', () => {
    expect(MODEL).toBe(process.env.CLAUDE_MODEL ?? 'claude-opus-5-5')
  })

  it('maps a missing parsed_output to null', async () => {
    parse.mockResolvedValue({ stop_reason: 'max_tokens' })
    expect(await modeloClaude({ system: '', messages: [] })).toEqual({ stop_reason: 'max_tokens', parsed_output: null })
  })

  it('propagates API errors to the caller (the webhook logs them)', async () => {
    parse.mockImplementation(async () => { throw new Error('529 overloaded') })
    const error = await modeloClaude({ system: '', messages: [] }).then(() => null, (e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('overloaded')
  })
})

describe('consulta factory sanity', () => {
  it('builds a valid empty consulta', () => expect(consulta().fotos).toEqual([]))
})
