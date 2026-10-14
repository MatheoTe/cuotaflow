import { createHash } from 'crypto'
import { NEGOCIO } from '../negocio'
import { calcularScore, calcularScoreConsulta, formatoARS, montoSugerido } from '../scoring'
import { DNI_FICTICIO } from '../seed/dni-ficticio'
import type { Datos, Message, Consulta } from '../types'
import type { ContextoAgente, Modelo, SalidaAgente } from './agent'

/**
 * Modelo offline del modo demo. Ocupa el mismo lugar que el modelo grabado de
 * los evals (la frontera `Modelo`): devuelve una salida estructurada sin red ni
 * costo, y el resto del camino (fusión, guardas, scoring, bureau, store) es el
 * de producción.
 *
 * No es un LLM: extrae con reglas lo que el guion de la demo y las variantes
 * razonables necesitan (montos en lunfardo, situación laboral, edad, DNI,
 * banco) y redacta respuestas cortas siguiendo las mismas reglas del prompt.
 * Lo que no entiende lo vuelve a preguntar.
 */
export function crearModeloDemo(ctx: ContextoAgente): Modelo {
  return async () => ({ stop_reason: 'end_turn', parsed_output: salidaDemo(ctx) })
}

type Campo = 'nombre' | 'monto_solicitado' | 'destino' | 'situacion_laboral' | 'ingresos_mensuales' | 'edad' | 'turno_verificacion'
type DatosSalida = SalidaAgente['datos']
type ConsultaSalida = NonNullable<SalidaAgente['consulta']>

const DATOS_NULOS: DatosSalida = {
  nombre: null, monto_solicitado: null, destino: null, situacion_laboral: null, ingresos_mensuales: null,
  edad: null, provincia: null, turno_verificacion: null, es_cliente_con_cuota: null,
}

const PRESENTACION = `soy ${NEGOCIO.agente} de ${NEGOCIO.nombre}`

/* ───────────────────────── Extracción ───────────────────────── */

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => sinTildes(s.toLowerCase()).replace(/\s+/g, ' ').trim()

/** "800 mil", "1 palo y medio", "1.100.000", "250 lucas", "3 millones", "1.2 M", "medio millón". */
export function extraerMonto(texto: string, { sinUnidadEsMil = false } = {}): number | null {
  const t = norm(texto)
  if (/\bmedio (millon|palo)\b/.test(t)) return 500_000
  if (/\bun (millon|palo)( y medio)?\b/.test(t)) return /y medio/.test(t) ? 1_500_000 : 1_000_000
  const re = /(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(millones|millon|palos?|m\b|mil\b|lucas?|k\b)?(\s*y\s*medio)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const crudo = m[1]
    const unidad = m[2] ?? ''
    let n = /^\d{1,3}(\.\d{3})+$/.test(crudo) ? Number(crudo.replace(/\./g, '')) : Number(crudo.replace(',', '.'))
    if (!Number.isFinite(n)) continue
    if (/^(millones|millon|palos?|m)$/.test(unidad)) n = n * 1_000_000 + (m[3] ? 500_000 : 0)
    else if (/^(mil|lucas?|k)$/.test(unidad)) n = n * 1_000 + (m[3] ? 500 : 0)
    else if (n < 1_000) {
      if (!sinUnidadEsMil || n < 10) continue
      n *= 1_000
    }
    return Math.round(n)
  }
  return null
}

function extraerSituacion(texto: string): DatosSalida['situacion_laboral'] {
  const t = norm(texto)
  if (/no tengo (trabajo|laburo)|sin (trabajo|laburo)|desemplead|desocupad|cobro un plan|plan social|no trabajo/.test(t)) return 'desempleado'
  if (/monotribut/.test(t)) return 'monotributista'
  if (/jubilad|pensionad|jubilacion/.test(t)) return 'jubilado'
  if (/changa|informal|en negro|por mi cuenta|cuentapropia/.test(t)) return 'informal'
  if (/relacion de dependencia|en blanco|empleado|empleada|recibo de sueldo|efectiv[oa]/.test(t)) return 'relacion_dependencia'
  return null
}

const PALABRAS_NO_NOMBRE = new Set(['hola', 'buenas', 'buen', 'dia', 'tardes', 'noches', 'si', 'no', 'ok', 'dale', 'gracias', 'plata', 'prestamo', 'necesito', 'quiero', 'consulta', 'cliente', 'que', 'como', 'tasa', 'cuota', 'trabajo', 'tengo', 'soy', 'me', 'llamo', 'mi', 'nombre', 'es', 'el', 'la'])

const capitalizar = (s: string) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())

/** Nombre cuando se lo pidió: "Gonzalo", "me llamo Ana María", "soy Carla". */
function extraerNombre(texto: string, pidiendo: boolean): string | null {
  const explicito = texto.match(/(?:me llamo|mi nombre es|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/)
  if (explicito) return explicito[1]
  if (!pidiendo) return null
  const limpio = texto.replace(/[.!¡¿?,]/g, ' ').trim()
  const palabras = limpio.split(/\s+/).filter(Boolean)
  if (palabras.length === 0 || palabras.length > 3) return null
  if (!palabras.every(p => /^\p{L}{2,}$/u.test(p) && !PALABRAS_NO_NOMBRE.has(norm(p)))) return null
  return capitalizar(palabras.join(' '))
}

function extraerEdad(texto: string, pidiendo: boolean): number | null {
  const t = norm(texto)
  const conAnios = t.match(/\b(\d{2})\s*anos\b/)
  if (conAnios) return Number(conAnios[1])
  if (!pidiendo) return null
  const solo = t.match(/^(?:tengo\s+)?(\d{1,3})\s*$/)
  const n = solo ? Number(solo[1]) : NaN
  return n >= 10 && n <= 110 ? n : null
}

function extraerDestino(texto: string, pidiendo: boolean): string | null {
  const para = texto.match(/\bpara\s+(.{3,60}?)(?:[.,;!?]|$)/i)
  if (para) return para[1].trim()
  if (!pidiendo || /\?/.test(texto) || texto.length > 60) return null
  return texto.trim() || null
}

const DIAS = /\b(lunes|martes|miercoles|jueves|viernes|hoy|manana|tarde|mediodia|\d{1,2}\s*(hs|h|am|pm)\b|a la ma)/

const esCobranza = (t: string) => /tengo un prestamo|ya soy cliente|mi cuota|la cuota|pagar la cuota|link para pagar|como (hago para )?pag|donde pago|me atrase|estoy atrasad/.test(t)
const pideHumano = (t: string) => /revis|una persona|un humano|analista|verificador|hablar con alguien/.test(t)
const preguntaTasa = (t: string) => /\btasa|interes|cuanto (se )?paga de cuota|cft|tna/.test(t)
const preguntaRequisitos = (t: string) => /requisito|que (necesito|piden|me piden)|que papeles/.test(t)
const preguntaSiEsBot = (t: string) => /sos (un )?(bot|robot|ia|una ia|humano|persona)|inteligencia artificial/.test(t)
const agradece = (t: string) => /^(muchas )?gracias|^genial|^perfecto|^dale|^buenisimo|^ok\b|^listo/.test(t)
const marcaCliente = (t: string) => /escribo como cliente|soy cliente final|ahora como cliente/.test(t)
const marcaVendedor = (t: string) => /escribo como vendedor|vuelvo a (ser )?vendedor|ahora como vendedor/.test(t)

/* ───────────────────────── Vendedor ───────────────────────── */

const BANCOS: Array<[RegExp, string]> = [
  [/\bnacion\b/, 'Banco Nación'], [/\bprovincia\b/, 'Banco Provincia'], [/\bgalicia\b/, 'Banco Galicia'],
  [/\bsantander\b/, 'Banco Santander'], [/\bmacro\b/, 'Banco Macro'], [/\b(bbva|frances)\b/, 'BBVA'],
  [/\bcredicoop\b/, 'Banco Credicoop'], [/\bciudad\b/, 'Banco Ciudad'], [/\bhsbc\b/, 'HSBC'], [/\bicbc\b/, 'ICBC'],
  [/\bsupervielle\b/, 'Banco Supervielle'], [/\bpatagonia\b/, 'Banco Patagonia'], [/\bhipotecario\b/, 'Banco Hipotecario'],
  [/\bbrubank\b/, 'Brubank'], [/\bmercado ?pago\b/, 'Mercado Pago'], [/\buala\b/, 'Ualá'], [/\bcordoba\b|\bbancor\b/, 'Banco de Córdoba'],
]
const NOMBRES_BANCO = new Set(['banco', 'nacion', 'provincia', 'galicia', 'santander', 'macro', 'bbva', 'frances', 'credicoop', 'ciudad', 'hsbc', 'icbc', 'supervielle', 'patagonia', 'hipotecario', 'brubank', 'mercado', 'pago', 'uala', 'cordoba', 'bancor'])
const NO_ES_NOMBRE_CLIENTE = new Set(['hola', 'sofi', 'te', 'paso', 'otra', 'consulta', 'cliente', 'dni', 'cobra', 'en', 'monto', 'pedido', 'telefono', 'quiere', 'pide', 'adjunto', 'la', 'foto', 'del', 'nueva', 'por', 'el', 'formulario', 'buenas', 'buen', 'dia', 'tardes', 'gracias', 'ahora', 'escribo', 'como', 'vendedor'])

function extraerBanco(texto: string): string | null {
  const t = norm(texto)
  for (const [re, nombre] of BANCOS) if (re.test(t)) return nombre
  const generico = texto.match(/\bbanco\s+([A-ZÁÉÍÓÚ][\wáéíóúñ]+)/i)
  return generico ? `Banco ${capitalizar(generico[1])}` : null
}

/** "Gutierrez Pablo", "Flores, Marta", "Choque Daniel": la corrida más larga de palabras con mayúscula. */
function extraerNombreCliente(texto: string): string | null {
  let mejor: string[] = []
  let actual: string[] = []
  for (const crudo of texto.split(/\s+/)) {
    const palabra = crudo.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
    const valida = /^\p{Lu}\p{L}+$/u.test(palabra) && !NO_ES_NOMBRE_CLIENTE.has(norm(palabra)) && !NOMBRES_BANCO.has(norm(palabra))
    if (valida) actual.push(palabra)
    if (!valida || /[.:;]$/.test(crudo)) {
      if (actual.length > mejor.length) mejor = actual
      actual = []
    }
  }
  if (actual.length > mejor.length) mejor = actual
  return mejor.length >= 2 ? mejor.slice(0, 4).join(' ') : null
}

/**
 * DNI: el número que sigue a "DNI"/"documento", o uno con forma de DNI
 * (33.444.555 o 7-8 dígitos seguidos). "1.200.000" sin la palabra DNI es un monto.
 */
export function extraerDni(texto: string): string | null {
  const conPalabra = texto.match(/\b(?:dni|documento|doc)\b\D{0,6}(\d{1,2}\.?\d{3}\.?\d{3})\b/i)
  if (conPalabra) return conPalabra[1].replace(/\D/g, '')
  const suelto = texto.match(/(?<![$\d.])\b(\d{2}\.\d{3}\.\d{3}|\d{7,8})\b(?!\s*(mil|lucas|millon|pesos))/i)
  return suelto ? suelto[1].replace(/\D/g, '') : null
}

function extraerTelefono(texto: string, dni: string | null): string | null {
  const t = norm(texto)
  const candidatos = texto.match(/\+?\d[\d\s-]{8,}\d/g) ?? []
  for (const c of candidatos) {
    const digitos = c.replace(/\D/g, '')
    if (digitos === dni || digitos.length < 10 || digitos.length > 13) continue
    if (digitos.length === 10) return `549${digitos}`
    return digitos
  }
  if (/\btel|telefono|cel|whatsapp/.test(t)) {
    const digitos = texto.replace(/\D/g, '')
    if (digitos.length >= 10 && digitos.length <= 13 && digitos !== dni) return digitos.length === 10 ? `549${digitos}` : digitos
  }
  return null
}

/** Primer nombre para hablarle al vendedor de su cliente: "Gutierrez Pablo" → "Pablo". */
const nombrePila = (apellidoNombre: string | null) => {
  const p = (apellidoNombre ?? '').replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  return p.length >= 2 ? capitalizar(p[1]) : p[0] ? capitalizar(p[0]) : 'el cliente'
}
const nombreDisplay = (apellidoNombre: string | null) => {
  const p = (apellidoNombre ?? '').replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  return p.length >= 2 ? capitalizar(`${p[1]} ${p[0]}`) : capitalizar(p[0] ?? 'El cliente')
}

function fotoEsDniFicticio(ctx: ContextoAgente, msg: Message | undefined): boolean | null {
  if (!msg?.media_id) return null
  const media = ctx.media.get(msg.media_id)
  if (!media) return null
  return createHash('sha256').update(Buffer.from(media.data, 'base64')).digest('hex') === DNI_FICTICIO.sha256
}

function salidaVendedor(ctx: ContextoAgente, ultimo: Message | undefined): SalidaAgente {
  const texto = ultimo?.body ?? ''
  const t = norm(texto)
  const actual = ctx.consulta
  const vendedor = (ctx.contact.name ?? '').split(' ')[0]
  const base = { rol: 'vendedor' as const, datos: DATOS_NULOS, stage: 'seguimiento' as const }

  // El sistema ya calificó: se redacta el resultado.
  if (ctx.nota && actual?.bureau) return { ...base, consulta: consultaVacia(), ...resultadoConsulta(actual) }

  const foto = fotoEsDniFicticio(ctx, ultimo)
  const textoUtil = foto != null && texto === '[foto]' ? '' : texto
  let dni = extraerDni(textoUtil)
  let nombre = extraerNombreCliente(textoUtil)
  if (foto) { dni = DNI_FICTICIO.dni; nombre = DNI_FICTICIO.nombre }
  const telefono = extraerTelefono(textoUtil, dni)
  const sinNumeros = textoUtil.replace(/\b\d{1,2}\.\d{3}\.\d{3}\b|\b\d{7,8}\b/g, ' ').replace(/\+?\d[\d\s-]{8,}\d/g, ' ')
  const monto = extraerMonto(sinNumeros, { sinUnidadEsMil: true })
  const banco = extraerBanco(textoUtil)

  const otraPersona = Boolean(actual && ((dni && actual.dni && dni !== actual.dni) || (nombre && actual.nombre_cliente && norm(nombre) !== norm(actual.nombre_cliente) && actual.completa)))
  const nueva = Boolean((dni || nombre) && (/\botra\b|consulta nueva|nueva consulta|te paso (una|otra)/.test(t) || otraPersona))
  const previa = nueva ? null : actual
  const consulta: ConsultaSalida = { nombre_cliente: nombre, dni, banco, monto, telefono_cliente: telefono, consulta_nueva: nueva }
  const algo = Boolean(nombre || dni || banco || monto || telefono)

  const enCurso = {
    nombre_cliente: nombre ?? previa?.nombre_cliente ?? null,
    dni: dni ?? previa?.dni ?? null,
    banco: banco ?? previa?.banco ?? null,
  }
  const pila = nombrePila(enCurso.nombre_cliente)

  if (foto === false && !algo) {
    return { ...base, consulta: actual ? consultaVacia() : null, reply: 'Recibí la foto, pero en esta demo solo leo el DNI de ejemplo. ¿Me pasás nombre, DNI y banco del cliente por texto?', resumen: 'Vendedor mandó una foto que la demo no lee.', proximo_paso: 'Esperar los datos por texto' }
  }
  if (!algo) {
    if (preguntaTasa(t)) return { ...base, consulta: null, reply: NEGOCIO.tasas, resumen: 'Vendedor consulta por tasas.', proximo_paso: 'Nada pendiente' }
    if (agradece(t)) return { ...base, consulta: null, reply: `De nada${vendedor ? `, ${vendedor}` : ''}. Cuando tengas otra consulta, pasame nombre, DNI y banco del cliente.`, resumen: 'Vendedor cerró la conversación.', proximo_paso: 'Nada pendiente' }
    return { ...base, consulta: null, reply: `Hola${vendedor ? `, ${vendedor}` : ''}. Pasame nombre y apellido, DNI y banco donde cobra el cliente (o la foto del DNI) y te lo califico al toque.`, resumen: 'Vendedor sin consulta en curso.', proximo_paso: 'Esperar datos del cliente' }
  }

  // Ya calificada y llegó el teléfono (u otro dato suelto): se anota.
  if (previa?.bureau && !nombre && !dni) {
    const tel = telefono ?? previa.telefono_cliente
    const reply = telefono
      ? `Anotado, +${telefono}. La llaman en el día desde ${NEGOCIO.nombre} para la verificación.`
      : `Anotado para ${nombrePila(previa.nombre_cliente)}.${tel ? '' : ' Cuando tengas su teléfono, pasámelo para la verificación.'}`
    return { ...base, consulta, reply, resumen: `${nombreDisplay(previa.nombre_cliente)}: ${tel ? 'teléfono tomado, ' : ''}consulta ya calificada.`, proximo_paso: tel ? `Llamar a ${nombrePila(previa.nombre_cliente)} para la verificación` : 'Pedir el teléfono del cliente' }
  }

  const faltan: Array<[keyof typeof enCurso, string]> = []
  if (!enCurso.nombre_cliente) faltan.push(['nombre_cliente', '¿Cómo se llama el cliente? Nombre y apellido.'])
  if (!enCurso.dni) faltan.push(['dni', `¿Me pasás el DNI de ${pila}?`])
  if (!enCurso.banco) faltan.push(['banco', `¿En qué banco cobra ${pila}?`])

  if (faltan.length) {
    const leido = foto ? `Leí el DNI: ${nombreDisplay(DNI_FICTICIO.nombre)}, DNI ${DNI_FICTICIO.dni}. ` : ''
    return { ...base, consulta, reply: leido + faltan[0][1], resumen: `Consulta de ${enCurso.nombre_cliente ? nombreDisplay(enCurso.nombre_cliente) : 'un cliente'} incompleta.`, proximo_paso: 'Esperar el dato que falta del vendedor' }
  }
  // Completa: el pipeline califica y vuelve a pedir la respuesta con el resultado.
  return { ...base, consulta, reply: 'Dame un segundo que lo consulto.', resumen: `Consulta de ${nombreDisplay(enCurso.nombre_cliente)} completa.`, proximo_paso: 'Calificar' }
}

const consultaVacia = (): ConsultaSalida => ({ nombre_cliente: null, dni: null, banco: null, monto: null, telefono_cliente: null, consulta_nueva: false })

function resultadoConsulta(c: Consulta): Pick<SalidaAgente, 'reply' | 'resumen' | 'proximo_paso'> {
  const { score } = calcularScoreConsulta(c)
  const nombre = nombreDisplay(c.nombre_cliente)
  const pila = nombrePila(c.nombre_cliente)
  const b = c.bureau!
  const leido = c.fotos.length && c.nombre_cliente === DNI_FICTICIO.nombre ? `Leí el DNI: ${nombre}, DNI ${c.dni}. ` : ''
  const banco = (c.banco ?? '').replace(/^Banco /, '')
  if (score >= 60) {
    const tope = montoSugerido(b)
    const entra = c.monto && tope && c.monto <= tope ? `, así que los ${formatoARS(c.monto)} entran` : ''
    const cierre = c.telefono_cliente ? `La llaman al +${c.telefono_cliente} para la verificación.` : `¿Me pasás el teléfono de ${pila} para la verificación?`
    return {
      reply: `${leido}${leido ? 'Está' : `${nombre} está`} en situación ${b.situacion} y cobra por ${banco}: el crédito queda pre-aprobado hasta ${formatoARS(tope)}${entra}. ${cierre}`,
      resumen: `${nombre}, ${banco}, situación ${b.situacion}. Pre-aprobado hasta ${formatoARS(tope)}.`,
      proximo_paso: c.telefono_cliente ? `Llamar a ${pila} para la verificación` : `Pedir el teléfono de ${pila} al vendedor`,
    }
  }
  const deuda = b.deuda_total ? ` con una deuda informada de ${formatoARS(b.deuda_total)}` : ''
  if (score >= 40) {
    return {
      reply: `${leido}${leido ? 'Figura' : `${nombre} figura`} en situación ${b.situacion}${deuda}. Así no lo puedo pre-aprobar directo: queda a revisión de un analista y te aviso por acá.`,
      resumen: `${nombre}, situación ${b.situacion}${deuda}. A revisión de un analista.`,
      proximo_paso: 'Revisión de un analista',
    }
  }
  return {
    reply: `${leido}${leido ? 'Está' : `${nombre} está`} en situación ${b.situacion}${deuda}: hoy no califica. Si querés, lo mira un analista.`,
    resumen: `${nombre}, situación ${b.situacion}${deuda}. No califica.`,
    proximo_paso: 'Nada, salvo que el vendedor pida revisión',
  }
}

/* ───────────────────────── Cliente final ───────────────────────── */

const ORDEN: Campo[] = ['nombre', 'monto_solicitado', 'destino', 'situacion_laboral', 'ingresos_mensuales', 'edad']
const PREGUNTA: Record<Campo, (d: Partial<DatosSalida>) => string> = {
  nombre: () => '¿Cómo te llamás?',
  monto_solicitado: d => `${d.nombre ? `Un gusto, ${d.nombre}. ` : ''}¿Qué monto estás necesitando?`,
  destino: () => '¿Para qué lo necesitás?',
  situacion_laboral: () => '¿Trabajás en relación de dependencia, sos monotributista, jubilado o tenés ingresos informales?',
  ingresos_mensuales: () => '¿Y cuánto ingresás por mes, más o menos?',
  edad: () => '¿Qué edad tenés?',
  turno_verificacion: () => `¿Qué día y franja te viene bien que te llamen, de ${NEGOCIO.horario}?`,
}

const DEMOSTRABLES = new Set(['relacion_dependencia', 'monotributista', 'jubilado'])

interface EstadoCliente {
  datos: Partial<DatosSalida>
  cobranza: boolean
  revision: boolean
  /** Qué campo se cargó con el último mensaje. */
  nuevos: Campo[]
}

function completo(d: Partial<DatosSalida>) { return calcularScore(d as Datos).completo && d.destino != null }

function veredicto(d: Partial<DatosSalida>): 'verificacion' | 'rechazado' {
  const { score } = calcularScore(d as Datos)
  if ((d.edad ?? 0) < 18 || !DEMOSTRABLES.has(d.situacion_laboral ?? '') || score < 40) return 'rechazado'
  return 'verificacion'
}

function pendiente(e: EstadoCliente): Campo | null {
  const falta = ORDEN.find(c => e.datos[c] == null)
  if (falta) return falta
  if (veredicto(e.datos) === 'verificacion' && !e.datos.turno_verificacion) return 'turno_verificacion'
  return null
}

/** Reconstruye la ficha releyendo el hilo del cliente, mensaje a mensaje, con lo que se le venía pidiendo. */
function estadoCliente(mensajes: Message[]): EstadoCliente {
  const e: EstadoCliente = { datos: {}, cobranza: false, revision: false, nuevos: [] }
  for (const m of mensajes) {
    const texto = m.body.replace(/^.*escribo como cliente[:,.]?\s*/i, '')
    const t = norm(texto)
    const pide = pendiente(e)
    const antes = { ...e.datos }
    if (esCobranza(t)) { e.cobranza = true; e.datos.es_cliente_con_cuota = true }
    if (e.datos.nombre == null) e.datos.nombre = extraerNombre(texto, pide === 'nombre')
    const situacion = extraerSituacion(texto)
    if (situacion) e.datos.situacion_laboral = situacion
    if (pide === 'ingresos_mensuales' || /\b(gano|cobro|ingreso|ingresos|haber|sueldo|facturo)\b/.test(t)) {
      const ingresos = extraerMonto(texto, { sinUnidadEsMil: pide === 'ingresos_mensuales' })
      if (ingresos != null) e.datos.ingresos_mensuales = ingresos
      else if (pide === 'ingresos_mensuales' && /\b(nada|cero|0)\b/.test(t)) e.datos.ingresos_mensuales = 0
    } else if (!e.cobranza && (pide === 'monto_solicitado' || /\b(necesito|quiero|prestamo|pido|me prestan|preciso)\b/.test(t))) {
      const monto = extraerMonto(texto, { sinUnidadEsMil: pide === 'monto_solicitado' })
      if (monto != null) e.datos.monto_solicitado = monto
    }
    if (!e.cobranza && e.datos.destino == null && (e.datos.monto_solicitado != null || pide === 'destino')) {
      const destino = extraerDestino(texto, pide === 'destino')
      if (destino) e.datos.destino = destino
    }
    const edad = extraerEdad(texto, pide === 'edad')
    if (edad != null) e.datos.edad = edad
    if (pide === 'turno_verificacion' && DIAS.test(t)) e.datos.turno_verificacion = texto.replace(/\s*(me viene bien|me queda bien|puedo)\s*[.!]*$/i, '').trim()
    if (pideHumano(t) && pide == null) e.revision = true
    e.nuevos = (Object.keys(e.datos) as Campo[]).filter(k => ORDEN.includes(k) || k === 'turno_verificacion').filter(k => e.datos[k] != null && antes[k] !== e.datos[k])
  }
  return e
}

/** Desde dónde se lee el hilo como cliente: el último "escribo como cliente", o todo. */
function hiloCliente(history: Message[]): Message[] {
  const conversados = history.filter(m => m.kind !== 'sistema')
  let desde = 0
  conversados.forEach((m, i) => { if (m.direction === 'in' && marcaCliente(norm(m.body))) desde = i })
  return conversados.slice(desde)
}

function salidaCliente(ctx: ContextoAgente, ultimo: Message | undefined): SalidaAgente {
  const hilo = hiloCliente(ctx.history)
  const entrantes = hilo.filter(m => m.direction === 'in')
  const e = estadoCliente(entrantes)
  const t = norm(ultimo?.body ?? '')
  const d = e.datos
  const nombre = d.nombre ?? null
  const yaHablamos = hilo.some(m => m.direction === 'out')
  const saludo = yaHablamos ? '' : `Hola${nombre ? ` ${nombre}` : ''}, ${PRESENTACION}. `
  const datos: DatosSalida = { ...DATOS_NULOS, ...d }
  const out = (reply: string, stage: SalidaAgente['stage'], resumen: string, proximo_paso: string): SalidaAgente =>
    ({ reply, rol: 'cliente', datos, consulta: null, stage, resumen, proximo_paso })
  const quien = nombre ?? 'Contacto sin nombre'

  if (e.cobranza || ctx.contact.datos.es_cliente_con_cuota) {
    datos.es_cliente_con_cuota = true
    const medios = `Podés pagar por ${NEGOCIO.cobranza.medios}.`
    if (/pag/.test(t) && yaHablamos) return out(medios, 'cobranza', `${quien}, cliente con cuota, pregunta cómo pagar.`, 'Cobranza confirma el pago')
    if (agradece(t)) return out(`De nada${nombre ? `, ${nombre}` : ''}. Cualquier cosa escribime por acá.`, 'cobranza', `${quien}, cliente con cuota, derivado a cobranza.`, 'Cobranza lo contacta')
    return out(`${saludo}Le paso tu caso al ${NEGOCIO.cobranza.nombre.toLowerCase()} y te escriben en el horario de atención, ${NEGOCIO.horario}. Si querés adelantarte, ${medios.charAt(0).toLowerCase()}${medios.slice(1)}`,
      'cobranza', `${quien} ya es cliente y consulta por su cuota. Derivado a cobranza.`, 'Cobranza le manda el medio de pago')
  }

  const falta = pendiente(e)
  const resumenDatos = [d.monto_solicitado && `pide ${formatoARS(d.monto_solicitado)}`, d.destino && `para ${d.destino}`, d.situacion_laboral && d.situacion_laboral.replace(/_/g, ' '), d.ingresos_mensuales != null && `ingresa ${formatoARS(d.ingresos_mensuales)}`, d.edad && `${d.edad} años`].filter(Boolean).join(', ')
  const resumen = `${quien}${resumenDatos ? `: ${resumenDatos}` : ''}.`

  // Preguntas laterales: se contestan y se retoma el dato pendiente.
  const retomar = falta && falta !== 'turno_verificacion' ? ` ${PREGUNTA[falta](d)}` : ''
  const etapaActual: SalidaAgente['stage'] = completo(d) ? (e.revision ? 'verificacion' : veredicto(d)) : 'nuevo'
  if (preguntaSiEsBot(t)) return out(`Soy la asistente virtual de ${NEGOCIO.nombre}; un verificador humano sigue tu caso.${retomar}`, etapaActual, resumen, 'Seguir calificando')
  if (preguntaTasa(t)) return out(`${saludo}${NEGOCIO.tasas}${retomar}`, etapaActual, resumen, completo(d) ? 'Informar la tasa en la llamada' : 'Seguir calificando')
  if (preguntaRequisitos(t)) return out(`${saludo}Te pedimos: ${NEGOCIO.requisitos.map(r => (/^\p{Lu}\p{Ll}/u.test(r) ? r.charAt(0).toLowerCase() + r.slice(1) : r)).join(', ')}.${retomar}`, etapaActual, resumen, 'Seguir calificando')

  if (!completo(d)) {
    const entendi = e.nuevos.length > 0 || !yaHablamos
    const gracias = yaHablamos && e.nuevos.includes('nombre') && falta !== 'monto_solicitado' ? `Gracias, ${nombre}. ` : ''
    const reply = `${saludo}${gracias}${entendi ? '' : 'Perdón, no te entendí. '}${PREGUNTA[falta!](d)}`
    const faltan = ORDEN.filter(c => d[c] == null).length
    return out(reply, 'nuevo', resumen, `Esperar respuesta del cliente (faltan ${faltan} dato${faltan === 1 ? '' : 's'})`)
  }

  const veredictoFinal = veredicto(d)
  if (veredictoFinal === 'rechazado') {
    if (e.revision) return out(`Sí, claro. Dejo tu caso para que lo revise un verificador y te escribe en el horario de atención, ${NEGOCIO.horario}.`, 'verificacion', resumen, 'Revisión manual por un verificador')
    if (e.nuevos.includes('edad') || e.nuevos.includes('ingresos_mensuales') || e.nuevos.includes('situacion_laboral') || e.nuevos.includes('monto_solicitado')) {
      const motivo = (d.edad ?? 0) < 18 ? 'siendo menor de 18' : d.situacion_laboral === 'desempleado' ? 'sin ingresos demostrables' : d.situacion_laboral === 'informal' ? `con ingresos informales de ${formatoARS(d.ingresos_mensuales)}` : `con ingresos de ${formatoARS(d.ingresos_mensuales)}, la cuota de ${formatoARS(d.monto_solicitado)} no entra y`
      return out(`Gracias por contarme${nombre ? `, ${nombre}` : ''}. Te soy sincera: ${motivo} hoy no te lo puedo pre-aprobar. Si querés, un verificador revisa tu caso.`, 'rechazado', `${resumen} No califica.`, 'Nada, salvo que pida revisión')
    }
    if (agradece(t)) return out(`De nada${nombre ? `, ${nombre}` : ''}. Si cambia tu situación, escribime.`, 'rechazado', `${resumen} No califica.`, 'Nada, salvo que pida revisión')
    return out('Hoy no te lo puedo pre-aprobar. Si querés, un verificador revisa tu caso: decime y lo dejo pedido.', 'rechazado', `${resumen} No califica.`, 'Nada, salvo que pida revisión')
  }

  // Califica: verificación telefónica.
  const { score } = calcularScore(d as Datos)
  const ajustada = score < 70
  if (!d.turno_verificacion) {
    if (e.nuevos.length === 0 && yaHablamos && !e.nuevos.includes('edad')) {
      return out(`Perdón, no te entendí el horario. ${PREGUNTA.turno_verificacion(d)}`, 'verificacion', `${resumen} Pre-aprobado, falta el turno.`, 'Acordar el turno de verificación')
    }
    const intro = ajustada
      ? `Con ese ingreso la cuota de ${formatoARS(d.monto_solicitado)} queda ajustada; te conviene un monto menor o más plazo, y lo vemos en una verificación telefónica de 5 minutos.`
      : 'Con eso tu pedido queda pre-aprobado. El paso siguiente es una verificación telefónica de 5 minutos.'
    return out(`${intro} ${PREGUNTA.turno_verificacion(d)}`, 'verificacion', `${resumen} ${ajustada ? 'Cuota ajustada: ofrecer menos monto.' : 'Pre-aprobado.'}`, ajustada ? 'Ofrecer menos monto en la llamada' : 'Acordar el turno de verificación')
  }
  if (e.nuevos.includes('turno_verificacion')) {
    return out(`Listo${nombre ? `, ${nombre}` : ''}. Te llaman ${d.turno_verificacion} desde ${NEGOCIO.nombre}. Tené el DNI a mano.`, 'verificacion', `${resumen} Turno: ${d.turno_verificacion}.`, `Llamar ${d.turno_verificacion}`)
  }
  if (agradece(t)) return out(`De nada${nombre ? `, ${nombre}` : ''}. Te llamamos como quedamos.`, 'verificacion', `${resumen} Turno: ${d.turno_verificacion}.`, `Llamar ${d.turno_verificacion}`)
  return out(`Ya quedó agendado: te llaman ${d.turno_verificacion}. Si necesitás cambiar el horario, decime.`, 'verificacion', `${resumen} Turno: ${d.turno_verificacion}.`, `Llamar ${d.turno_verificacion}`)
}

/* ───────────────────────── Rol ───────────────────────── */

function senalVendedor(ctx: ContextoAgente, m: Message): boolean {
  const t = norm(m.body)
  if (m.media_id || marcaVendedor(t) || extraerDni(m.body)) return true
  if (/te paso (una|otra|esta)/.test(t) || /\bcliente:?\s+\p{Lu}\p{L}+,?\s+\p{Lu}/u.test(m.body)) return true
  // Señales débiles: solo cuentan si el contacto ya es vendedor.
  return ctx.contact.tipo === 'vendedor' && (/consulta|\bcobra (en|por)\b|\btel\b|telefono|\bcel\b/.test(t) || extraerBanco(m.body) != null)
}

function senalCliente(m: Message): boolean {
  const t = norm(m.body)
  return marcaCliente(t) || /\b(necesito|quiero|preciso)\b.*\b(plata|prestamo|\d)|\bnecesito plata\b|\bquiero un prestamo\b/.test(t) || esCobranza(t)
}

/** El rol del último mensaje, o el de la última señal clara del hilo. */
function rolActual(ctx: ContextoAgente): 'cliente' | 'vendedor' {
  const entrantes = ctx.history.filter(m => m.direction === 'in' && m.kind !== 'sistema')
  for (let i = entrantes.length - 1; i >= 0; i--) {
    const m = entrantes[i]
    if (marcaCliente(norm(m.body))) return 'cliente'
    if (senalVendedor(ctx, m)) return 'vendedor'
    if (ctx.contact.tipo === 'vendedor' && senalCliente(m)) return 'cliente'
  }
  return ctx.contact.tipo
}

export function salidaDemo(ctx: ContextoAgente): SalidaAgente {
  const ultimo = [...ctx.history].reverse().find(m => m.direction === 'in' && m.kind !== 'sistema')
  if (ctx.nota && ctx.consulta) return salidaVendedor(ctx, ultimo)
  return rolActual(ctx) === 'vendedor' ? salidaVendedor(ctx, ultimo) : salidaCliente(ctx, ultimo)
}
