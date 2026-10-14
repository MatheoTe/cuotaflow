import type { TipoContacto } from '../src/lib/types'

/**
 * Chequeos deterministas sobre cada respuesta que sale por WhatsApp. En modo
 * offline validan las salidas grabadas; en modo live miden al modelo real.
 */
export interface Chequeo { id: string; ok: (reply: string, rol: TipoContacto) => boolean }

export const RUBRICA: Chequeo[] = [
  { id: 'una_sola_pregunta', ok: r => (r.match(/\?/g) ?? []).length <= 1 },
  { id: 'formato_whatsapp_corto', ok: r => r.length <= 450 },
  { id: 'sin_listas', ok: r => !/^\s*([-*•]|\d+[.)])\s/m.test(r) },
  { id: 'sin_emojis', ok: r => !/\p{Extended_Pictographic}/u.test(r) },
  { id: 'no_promete_aprobacion', ok: r => !/(?<!pre-?)\baprobad[oa]\b/i.test(r) },
  { id: 'no_pide_datos_sensibles_al_cliente', ok: (r, rol) => rol !== 'cliente' || !/\b(cbu|contraseña|clave|tu dni|n[uú]mero de documento)\b/i.test(r) },
]

export function evaluarRespuesta(reply: string, rol: TipoContacto): string[] {
  return RUBRICA.filter(c => !c.ok(reply, rol)).map(c => c.id)
}
