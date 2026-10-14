/**
 * Al arrancar el servidor (o una función en frío en Vercel), el modo demo
 * siembra el store en memoria antes de atender el primer pedido.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { esDemo } = await import('./lib/demo')
  if (!esDemo()) return
  const [{ demoStore }, { demoCobranzas }] = await Promise.all([import('./lib/db'), import('./lib/cobranzas')])
  const [contactos, cuentas] = await Promise.all([demoStore().listContacts(), demoCobranzas().list()])
  console.log(`[demo] DEMO_MODE activo: datos ficticios en memoria (${contactos.length} contactos, ${cuentas.length} cuentas). Claude y WhatsApp deshabilitados.`)
}
