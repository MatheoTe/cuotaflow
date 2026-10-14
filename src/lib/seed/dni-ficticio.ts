import { readFileSync } from 'fs'
import path from 'path'

/**
 * El DNI ficticio de la demo (public/demo/dni-ficticio.png). El modelo offline
 * del modo demo no lee imágenes: reconoce esta foto por su hash y devuelve los
 * datos impresos en ella, como haría Claude con visión.
 */
export const DNI_FICTICIO = {
  sha256: '8357250fb5a251dab2edb88419ec111d6c125bd4a5bae47b49d5a4d1ab5bab25',
  nombre: 'Villalba Mariela Soledad',
  dni: '33444555',
} as const

export const RUTA_DNI_FICTICIO = path.join('public', 'demo', 'dni-ficticio.png')

/** Lee la foto para sembrarla. Si no está en el bundle, la semilla sigue sin ella. */
export function leerDniFicticio(): { mime: string; data: string } | null {
  try {
    return { mime: 'image/png', data: readFileSync(path.join(process.cwd(), RUTA_DNI_FICTICIO)).toString('base64') }
  } catch {
    console.warn('[demo] no se encontró', RUTA_DNI_FICTICIO, '- la semilla va sin la foto del DNI')
    return null
  }
}
