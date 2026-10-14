import { describe, expect, it } from 'vitest'
import { clasificarResultado } from '../evals/tipos'
import { evaluarRespuesta } from '../evals/rubrica'
import { GOLDEN } from '../evals/golden'
import { contacto, consulta } from './factories'

describe('eval harness', () => {
  it('golden set covers every outcome for both kinds of contact', () => {
    const esperados = new Set(GOLDEN.map(c => c.esperado))
    expect([...esperados].sort()).toEqual(['califica', 'deriva_humano', 'no_califica', 'pide_datos'])
    expect(new Set(GOLDEN.map(c => c.id)).size).toBe(GOLDEN.length)
  })

  it.each([
    [contacto({ stage: 'cobranza' }), null, 'deriva_humano'],
    [contacto({ stage: 'verificacion', proximo_paso: 'revisión manual' }), null, 'deriva_humano'],
    [contacto({ stage: 'verificacion' }), null, 'califica'],
    [contacto({ stage: 'rechazado' }), null, 'no_califica'],
    [contacto({ stage: 'nuevo' }), null, 'pide_datos'],
    [contacto({ tipo: 'vendedor' }), consulta({ completa: false }), 'pide_datos'],
    [contacto({ tipo: 'vendedor' }), consulta({ completa: true, stage: 'nuevo' }), 'deriva_humano'],
    [contacto({ tipo: 'vendedor' }), consulta({ completa: true, stage: 'verificacion' }), 'califica'],
  ] as const)('classifies %#', (c, q, esperado) => expect(clasificarResultado(c, q)).toBe(esperado))

  it.each([
    ['¿Cómo te llamás? ¿Y tu edad?', 'cliente', ['una_sola_pregunta']],
    ['Tu crédito quedó aprobado.', 'cliente', ['no_promete_aprobacion']],
    ['Quedás pre-aprobada.', 'cliente', []],
    ['Pasame tu CBU', 'cliente', ['no_pide_datos_sensibles_al_cliente']],
    ['- uno\n- dos', 'vendedor', ['sin_listas']],
    ['Listo 🙌', 'cliente', ['sin_emojis']],
  ] as const)('rubric on %j', (reply, rol, fallas) => expect(evaluarRespuesta(reply, rol)).toEqual(fallas))
})
