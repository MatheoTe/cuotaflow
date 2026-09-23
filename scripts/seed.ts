/**
 * Carga contactos ficticios para que el tablero no arranque vacío.
 *   npx tsx scripts/seed.ts          → agrega
 *   npx tsx scripts/seed.ts --reset  → borra todo y agrega
 */
import { db } from '../src/lib/db'
import { calcularScore } from '../src/lib/scoring'
import type { Datos } from '../src/lib/types'
import type { Etapa } from '../src/lib/negocio'
import { VENDEDORES } from '../src/lib/negocio'
import { calcularScoreConsulta, consultarBureau, etapaPorScore } from '../src/lib/scoring'

interface Semilla {
  phone: string; name: string; stage: Etapa; datos: Datos; resumen: string; proximo_paso: string
  cuota?: number; vencimiento?: string
  hilo: Array<['in' | 'out', string]>
}

const SEMILLAS: Semilla[] = [
  {
    phone: '5491160000001', name: 'Lucía Fernández', stage: 'verificacion',
    datos: { nombre: 'Lucía', monto_solicitado: 600000, destino: 'arreglar el auto', situacion_laboral: 'relacion_dependencia', ingresos_mensuales: 1100000, edad: 34, turno_verificacion: 'mañana a la mañana, entre 9 y 12' },
    resumen: 'Lucía pide 600 mil para el auto, en blanco, cuota entra cómoda. Quedó para llamada mañana entre 9 y 12.', proximo_paso: 'Llamar mañana 9 a 12 y tomar DNI',
    hilo: [['in', 'Hola, quería saber si puedo sacar un préstamo'], ['out', 'Hola, soy Sofi de Comarfin Mutual. Sí, te ayudo con eso. ¿Cómo es tu nombre?'], ['in', 'Lucía'], ['out', 'Un gusto, Lucía. ¿Qué monto estás necesitando?'], ['in', 'unos 600 mil, es para arreglar el auto'], ['out', 'Perfecto. ¿Trabajás en relación de dependencia, sos monotributista, jubilada o tenés ingresos informales?'], ['in', 'en blanco, relación de dependencia'], ['out', '¿Y de cuánto son tus ingresos mensuales, más o menos?'], ['in', 'como 1.100.000'], ['out', '¿Qué edad tenés?'], ['in', '34'], ['out', 'Con eso quedás pre-aprobada. El paso siguiente es una verificación telefónica de 5 minutos. ¿Qué día y en qué franja te viene bien que te llamen, de lunes a viernes de 9 a 18?'], ['in', 'mañana a la mañana, entre 9 y 12'], ['out', 'Listo, Lucía. Te llaman mañana entre 9 y 12 desde Comarfin Mutual. Tené el DNI a mano.']],
  },
  {
    phone: '5491160000002', name: 'Marcos Peralta', stage: 'cobranza', cuota: 85000, vencimiento: '2026-09-28',
    datos: { nombre: 'Marcos', es_cliente_con_cuota: true },
    resumen: 'Marcos ya es cliente, pregunta si puede pagar la cuota de este mes unos días después. Pasado a cobranza.', proximo_paso: 'Cobranza lo contacta para acordar fecha',
    hilo: [['in', 'Hola, soy Marcos Peralta, este mes se me complicó, puedo pagar la cuota el 5 en vez del 28?'], ['out', 'Hola Marcos, soy Sofi. Anoté tu pedido de pasar el pago al 5. Le paso tu caso al sector de cobranza y te escriben en el horario de atención, lunes a viernes de 9 a 18, para confirmarlo.']],
  },
  {
    phone: '5491160000003', name: 'Rodrigo Ábalos', stage: 'nuevo',
    datos: { nombre: 'Rodrigo', monto_solicitado: 250000, destino: 'una deuda de tarjeta' },
    resumen: 'Rodrigo pide 250 mil para tapar tarjeta. Falta situación laboral, ingresos y edad.', proximo_paso: 'Esperar respuesta del cliente',
    hilo: [['in', 'buenas, necesito 250 lucas para una deuda de tarjeta'], ['out', 'Hola, soy Sofi de Comarfin Mutual. Te ayudo. ¿Cómo es tu nombre?'], ['in', 'Rodrigo'], ['out', 'Gracias, Rodrigo. ¿Trabajás en relación de dependencia, sos monotributista, jubilado o tenés ingresos informales?']],
  },
  {
    phone: '5491160000004', name: 'Nora Giménez', stage: 'seguimiento',
    datos: { nombre: 'Nora', monto_solicitado: 300000, destino: 'gastos médicos', situacion_laboral: 'jubilado', ingresos_mensuales: 520000, edad: 68, turno_verificacion: 'lunes a la tarde' },
    resumen: 'Nora, jubilada, 300 mil para gastos médicos. Verificada el lunes, esperando acreditación.', proximo_paso: 'Confirmar acreditación y avisar',
    hilo: [['in', 'Hola, soy Nora, jubilada, necesito 300 mil para unos estudios médicos'], ['out', 'Hola Nora, soy Sofi de Comarfin Mutual. Te ayudo. ¿De cuánto es tu haber mensual, más o menos?'], ['in', '520 mil'], ['out', '¿Qué edad tenés?'], ['in', '68'], ['out', 'Quedás pre-aprobada. Falta una verificación telefónica de 5 minutos. ¿Qué día y franja te viene bien, de lunes a viernes de 9 a 18?'], ['in', 'el lunes a la tarde'], ['out', 'Perfecto, Nora. Te llaman el lunes a la tarde desde Comarfin Mutual.']],
  },
  {
    phone: '5491160000005', name: 'Brian Sosa', stage: 'rechazado',
    datos: { nombre: 'Brian', monto_solicitado: 1500000, destino: 'poner un negocio', situacion_laboral: 'informal', ingresos_mensuales: 300000, edad: 22 },
    resumen: 'Brian pide 1,5 millones con ingresos informales de 300 mil. No entra la cuota; se le explicó.', proximo_paso: 'Nada, salvo que vuelva con ingresos demostrables',
    hilo: [['in', 'hola quiero 1 millon y medio para poner un negocio'], ['out', 'Hola, soy Sofi de Comarfin Mutual. ¿Cómo es tu nombre?'], ['in', 'Brian'], ['out', '¿Trabajás en relación de dependencia, sos monotributista, o tenés ingresos informales?'], ['in', 'hago changas, informal'], ['out', '¿Y cuánto ingresás por mes, aproximado?'], ['in', '300 mil'], ['out', '¿Qué edad tenés?'], ['in', '22'], ['out', 'Te soy sincera, Brian: con ingresos informales de 300 mil, la cuota de 1,5 millones no entra, y hoy no te lo podría pre-aprobar. Si en algún momento tenés ingresos demostrables o querés un monto menor, escribime y lo vemos.']],
  },
]

/** Vendedor de la sucursal Norte con dos consultas ya procesadas. */
async function sembrarVendedor(store: ReturnType<typeof db>) {
  const v = VENDEDORES[0]
  if (await store.getContactByPhone(v.phone)) { console.log('ya existe', v.nombre); return }
  const c = await store.createContact(v.phone, v.nombre, 'vendedor', v.sucursal)
  await store.updateContact(c.id, { stage: 'seguimiento', resumen: 'Vendedor de la sucursal Norte. Manda consultas de clientes por acá en vez de por mail.', proximo_paso: 'Nada pendiente' })

  const consultas: Array<{ nombre: string; dni: string; banco: string; monto: number | null; hilo: Array<['in' | 'out', string]> }> = [
    { nombre: 'Mamani, Rosa', dni: '11222333', banco: 'Banco Nación', monto: 400000, hilo: [
      ['in', 'Hola Sofi, te paso una consulta: Mamani Rosa, DNI 11222333, cobra en Banco Nación, quiere 400 mil'],
      ['out', 'Listo, Ramiro. Rosa Mamani está en situación 1, sin deudas informadas, y cobra por Banco Nación: queda pre-aprobada hasta $1.500.000, así que los 400 mil entran cómodos. Pasame el teléfono de Rosa para la verificación.'],
      ['in', '3885 44 1122'],
      ['out', 'Anotado. La llaman en el día desde Comarfin Mutual.'],
    ] },
    { nombre: 'Choque, Daniel', dni: '30111222', banco: 'Banco Macro', monto: 900000, hilo: [
      ['in', 'Otra: Choque Daniel, DNI 30111222, Macro, pide 900'],
      ['out', 'Ramiro, Daniel Choque figura en situación 3 con una deuda informada de $178.000. Con eso no lo puedo pre-aprobar por 900 mil. Si quiere, lo revisa un analista y ve si entra un monto menor; decime y lo dejo marcado.'],
    ] },
  ]
  for (const q of consultas) {
    for (const [direction, body] of q.hilo) await store.addMessage({ contact_id: c.id, direction, body })
    const k = await store.createConsulta(c.id)
    const base = { nombre_cliente: q.nombre, dni: q.dni, banco: q.banco, monto: q.monto, bureau: consultarBureau(q.dni) }
    const { score } = calcularScoreConsulta(base)
    await store.updateConsulta(k.id, { ...base, completa: true, score, stage: etapaPorScore(score), telefono_cliente: q.nombre.startsWith('Mamani') ? '5493885441122' : null,
      resumen: q.nombre.startsWith('Mamani') ? 'Rosa Mamani, Banco Nación, situación 1. Pre-aprobada por 400 mil, teléfono tomado.' : 'Daniel Choque, Macro, situación 3 con deuda. No pre-aprobado por 900 mil; pendiente si el vendedor pide revisión.',
      proximo_paso: q.nombre.startsWith('Mamani') ? 'Llamar a Rosa para la verificación' : 'Esperar al vendedor' })
  }
  console.log('creado', v.nombre, 'con', consultas.length, 'consultas')
}

async function main() {
  const reset = process.argv.includes('--reset')
  const store = db()
  if (reset) await store.reset()
  await sembrarVendedor(store)
  for (const s of SEMILLAS) {
    if (await store.getContactByPhone(s.phone)) { console.log('ya existe', s.name); continue }
    const c = await store.createContact(s.phone, s.name)
    for (const [direction, body] of s.hilo) await store.addMessage({ contact_id: c.id, direction, body })
    await store.updateContact(c.id, { stage: s.stage, datos: s.datos, score: calcularScore(s.datos).score, resumen: s.resumen, proximo_paso: s.proximo_paso, cuota: s.cuota ?? null, vencimiento: s.vencimiento ?? null })
    console.log('creado', s.name)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
