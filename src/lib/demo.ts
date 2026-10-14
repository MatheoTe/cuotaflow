/**
 * Modo demo público (DEMO_MODE=1): sin secretos y sin gastar plata.
 *  - El agente responde con un modelo offline determinista (nunca llama a Claude).
 *  - Los datos viven en memoria, sembrados al arrancar con la semilla ficticia.
 *  - El webhook de WhatsApp y todo envío saliente quedan apagados.
 */
export function esDemo(): boolean {
  const v = (process.env.DEMO_MODE ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

export const REPO_URL = 'https://github.com/MatheoTe/cuotaflow'

/** Topes del simulador público. */
export const LIMITES_DEMO = {
  /** Caracteres por mensaje. */
  maxTexto: 500,
  /** Bytes por foto adjunta. */
  maxImagenBytes: 1.5 * 1024 * 1024,
  /** Mensajes por IP: ráfaga corta y total por hora. */
  porMinuto: 12,
  porHora: 120,
} as const
