/**
 * Limitador de ventana deslizante en memoria, por clave (la IP). Es por
 * instancia: alcanza como freno básico de abuso para la demo, no como cuota global.
 */
export interface Ventana { ms: number; max: number }

export function crearLimitador(ventanas: Ventana[], maxClaves = 10_000) {
  const golpes = new Map<string, number[]>()
  const mayor = Math.max(...ventanas.map(v => v.ms))

  return {
    /** Registra un intento y dice si se permite; si no, cuántos segundos esperar. */
    permitir(clave: string, ahora = Date.now()): { ok: true } | { ok: false; reintentarEn: number } {
      const previos = (golpes.get(clave) ?? []).filter(t => ahora - t < mayor)
      for (const v of ventanas) {
        const dentro = previos.filter(t => ahora - t < v.ms)
        if (dentro.length >= v.max) {
          golpes.set(clave, previos)
          return { ok: false, reintentarEn: Math.max(1, Math.ceil((dentro[0] + v.ms - ahora) / 1000)) }
        }
      }
      previos.push(ahora)
      golpes.set(clave, previos)
      if (golpes.size > maxClaves) {
        // Poda: se descartan las claves más viejas (orden de inserción del Map).
        for (const k of golpes.keys()) { golpes.delete(k); if (golpes.size <= maxClaves / 2) break }
      }
      return { ok: true }
    },
    limpiar() { golpes.clear() },
  }
}

/** IP del visitante según los encabezados del proxy (Vercel pone x-forwarded-for). */
export function ipDe(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'desconocida'
}
