/**
 * Carga contactos ficticios para que el tablero no arranque vacío.
 *   npx tsx scripts/seed.ts          → agrega
 *   npx tsx scripts/seed.ts --reset  → borra todo y agrega
 * La semilla vive en src/lib/seed/originacion.ts (el modo demo usa la misma).
 */
import { db } from '../src/lib/db'
import { sembrarOriginacion } from '../src/lib/seed/originacion'

async function main() {
  const store = db()
  if (process.argv.includes('--reset')) await store.reset()
  await sembrarOriginacion(store, { log: m => console.log(m) })
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
