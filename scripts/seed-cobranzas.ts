/**
 * Cartera ficticia para el embudo de cobranzas.
 *   npx tsx scripts/seed-cobranzas.ts   → borra la cartera y la vuelve a cargar
 * La cartera vive en src/lib/seed/cobranzas.ts (el modo demo usa la misma).
 */
import { cobranzas } from '../src/lib/cobranzas'
import { cuentasDemo } from '../src/lib/seed/cobranzas'

async function main() {
  const s = cobranzas()
  const cuentas = cuentasDemo()
  await s.reset()
  await s.insertMany(cuentas)
  console.log(`cartera cargada: ${cuentas.length} cuentas`)
}
main().catch(e => { console.error(e); process.exit(1) })
