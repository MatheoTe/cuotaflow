/**
 * Evals del agente sobre el golden set.
 *
 *   npm run evals                 → offline: reproduce salidas grabadas del modelo (sin red, sin costo)
 *   npm run evals -- --live       → live: llama a Claude de verdad (requiere ANTHROPIC_API_KEY)
 *   npm run evals -- --only <id>  → un solo caso
 *
 * Offline mide la capa determinista que rodea al modelo (fusión de datos,
 * guardas, scoring, bureau, flujo de consultas) y que las salidas grabadas
 * cumplen la rúbrica. Live mide al modelo: mismas conversaciones, mismo criterio.
 */
import { MemoryStore } from '../src/lib/db'
import { procesarEntrante } from '../src/lib/pipeline'
import { modeloClaude, responder, MODEL, type Modelo, type SalidaAgente } from '../src/lib/agent/agent'
import { GOLDEN } from './golden'
import { clasificarResultado, type Caso, type SalidaGrabada } from './tipos'
import { evaluarRespuesta } from './rubrica'

const args = process.argv.slice(2)
const live = args.includes('--live')
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const umbral = Number(process.env.EVAL_MIN_PASS_RATE ?? (live ? 0.8 : 1))

if (live && !process.env.ANTHROPIC_API_KEY) {
  console.error('--live necesita ANTHROPIC_API_KEY. Sin la clave, corré `npm run evals` (offline).')
  process.exit(2)
}

const DATOS_VACIOS: SalidaAgente['datos'] = {
  nombre: null, monto_solicitado: null, destino: null, situacion_laboral: null, ingresos_mensuales: null,
  edad: null, provincia: null, turno_verificacion: null, es_cliente_con_cuota: null,
}

function completar(g: SalidaGrabada): SalidaAgente {
  const { datos, consulta, ...resto } = g
  return {
    reply: '', rol: 'cliente', stage: 'nuevo', resumen: 'eval', proximo_paso: 'eval',
    ...resto,
    datos: { ...DATOS_VACIOS, ...datos },
    consulta: consulta === undefined || consulta === null ? null : {
      nombre_cliente: null, dni: null, banco: null, monto: null, telefono_cliente: null, consulta_nueva: false, ...consulta,
    },
  }
}

/** Doble del modelo que devuelve las salidas grabadas del caso, en orden. */
function modeloGrabado(caso: Caso): Modelo {
  const cola = [...caso.grabadas]
  return async () => {
    const g = cola.shift()
    if (!g) throw new Error(`el caso ${caso.id} pidió más salidas que las grabadas`)
    return { stop_reason: 'end_turn', parsed_output: completar(g) }
  }
}

interface Fila { id: string; esperado: string; obtenido: string; rubrica: string[]; error?: string; ms: number }

async function correr(caso: Caso): Promise<Fila> {
  const t0 = Date.now()
  const store = new MemoryStore()
  const modelo = live ? modeloClaude : modeloGrabado(caso)
  const rubrica = new Set<string>()
  try {
    let ultimo: Awaited<ReturnType<typeof procesarEntrante>> | null = null
    for (const text of caso.mensajes) {
      ultimo = await procesarEntrante({ phone: caso.telefono, text }, { store, responder: ctx => responder(ctx, modelo) })
      for (const falla of evaluarRespuesta(ultimo.reply.body, ultimo.contact.tipo)) rubrica.add(falla)
    }
    const obtenido = clasificarResultado(ultimo!.contact, ultimo!.consulta)
    return { id: caso.id, esperado: caso.esperado, obtenido, rubrica: [...rubrica], ms: Date.now() - t0 }
  } catch (err) {
    return { id: caso.id, esperado: caso.esperado, obtenido: 'error', rubrica: [...rubrica], error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 }
  }
}

async function main() {
  const casos = GOLDEN.filter(c => !only || c.id === only)
  if (casos.length === 0) { console.error(`no hay caso "${only}"`); process.exit(2) }

  // Las guardas avisan por console.warn; en el reporte se cuentan aparte.
  let guardas = 0
  const warn = console.warn
  console.warn = (...a: unknown[]) => { if (String(a[0]).startsWith('[agente] guardas')) guardas++; else warn(...a) }

  console.log(`Evals · ${live ? `LIVE (${MODEL})` : 'offline (salidas grabadas)'} · ${casos.length} casos\n`)
  const filas: Fila[] = []
  for (const caso of casos) {
    const f = await correr(caso)
    filas.push(f)
    const ok = f.obtenido === f.esperado && f.rubrica.length === 0
    const detalle = f.error ? `error: ${f.error}` : f.obtenido !== f.esperado ? `esperado ${f.esperado}, obtuvo ${f.obtenido}` : f.rubrica.length ? `rúbrica: ${f.rubrica.join(', ')}` : f.obtenido
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${caso.id.padEnd(34)} ${detalle}${live ? `  (${(f.ms / 1000).toFixed(1)}s)` : ''}`)
  }
  console.warn = warn

  const pasan = filas.filter(f => f.obtenido === f.esperado && f.rubrica.length === 0).length
  const tasa = pasan / filas.length
  const porResultado = filas.filter(f => f.obtenido === f.esperado).length
  console.log(`\nResultado correcto: ${porResultado}/${filas.length} · Rúbrica limpia: ${filas.filter(f => f.rubrica.length === 0).length}/${filas.length} · Guardas disparadas: ${guardas}`)
  console.log(`Pass rate: ${(tasa * 100).toFixed(1)}% (mínimo ${(umbral * 100).toFixed(0)}%)`)
  process.exit(tasa >= umbral ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
