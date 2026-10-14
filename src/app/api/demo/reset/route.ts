import { NextResponse } from 'next/server'
import { esDemo } from '@/lib/demo'
import { demoStore } from '@/lib/db'
import { demoCobranzas } from '@/lib/cobranzas'
import { mismoSecreto } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Vuelve la demo a la semilla. Protegido con DEMO_RESET_TOKEN, que se manda en
 * `x-demo-reset-token` o como `Authorization: Bearer <token>`. El cron de Vercel
 * manda `Authorization: Bearer $CRON_SECRET`: también se acepta ese secreto.
 * Fuera del modo demo la ruta no existe.
 */
async function reset(req: Request) {
  if (!esDemo()) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
  const token = req.headers.get('x-demo-reset-token') ?? bearer
  const valido = mismoSecreto(token, process.env.DEMO_RESET_TOKEN) || mismoSecreto(bearer, process.env.CRON_SECRET)
  if (!valido) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await Promise.all([demoStore().resembrar(), demoCobranzas().resembrar()])
  const [contactos, cuentas] = await Promise.all([demoStore().listContacts(), demoCobranzas().list()])
  return NextResponse.json({ ok: true, contactos: contactos.length, cuentas: cuentas.length, at: new Date().toISOString() })
}

export const GET = reset
export const POST = reset
