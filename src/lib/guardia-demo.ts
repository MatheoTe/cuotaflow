import { NextResponse } from 'next/server'
import { esDemo, LIMITES_DEMO } from './demo'
import { crearLimitador, ipDe } from './limite'

const limitador = crearLimitador([
  { ms: 60_000, max: LIMITES_DEMO.porMinuto },
  { ms: 60 * 60_000, max: LIMITES_DEMO.porHora },
])

/**
 * Freno de abuso para las rutas que corren al agente en la demo pública:
 * tope de largo del mensaje y de la foto, y límite de mensajes por IP.
 * Fuera del modo demo no hace nada. Devuelve la respuesta de rechazo o null.
 */
export function guardiaDemo(req: Request, entrada: { texto: string; imagenBase64?: string | null }): NextResponse | null {
  if (!esDemo()) return null
  if (entrada.texto.length > LIMITES_DEMO.maxTexto) {
    return NextResponse.json({ error: `En la demo los mensajes tienen hasta ${LIMITES_DEMO.maxTexto} caracteres.` }, { status: 413 })
  }
  if (entrada.imagenBase64 && entrada.imagenBase64.length * 0.75 > LIMITES_DEMO.maxImagenBytes) {
    return NextResponse.json({ error: 'En la demo las fotos tienen hasta 1,5 MB.' }, { status: 413 })
  }
  const r = limitador.permitir(ipDe(req))
  if (!r.ok) {
    return NextResponse.json({ error: `Demasiados mensajes seguidos. Probá de nuevo en ${r.reintentarEn} s.` }, { status: 429, headers: { 'Retry-After': String(r.reintentarEn) } })
  }
  return null
}

/** Solo para tests. */
export const _limitadorDemo = limitador
