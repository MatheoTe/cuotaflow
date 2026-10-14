/**
 * Cartera ficticia para el embudo de cobranzas.
 *   npx tsx scripts/seed-cobranzas.ts   → borra la cartera y la vuelve a cargar
 */
import { cobranzas, type EtapaCobranza, type Gestion, type NuevaCuenta, OPERADORES } from '../src/lib/cobranzas'

const HOY = new Date()
const dia = (offset: number, hora = 11) => { const d = new Date(HOY); d.setDate(d.getDate() + offset); d.setHours(hora, 0, 0, 0); return d }
const iso = (offset: number, hora?: number) => dia(offset, hora).toISOString()
const fecha = (offset: number) => dia(offset).toISOString().slice(0, 10)

interface Semilla {
  nombre: string; stage: EtapaCobranza; cuota: number; total: number; pagas: number; vencidas: number; mora: number
  op: number; promesa?: [number, number]; recuperado?: number
  gestiones?: Array<[number, Gestion['canal'], Gestion['resultado'], string, number?]>
}

const S: Semilla[] = [
  // Por vencer: recordatorio automático por plantilla
  { nombre: 'Gustavo Rivas', stage: 'por_vencer', cuota: 92000, total: 12, pagas: 4, vencidas: 0, mora: -2, op: 0, gestiones: [[-1, 'plantilla', 'recordatorio', 'Recordatorio automático: vence en 3 días']] },
  { nombre: 'Natalia Correa', stage: 'por_vencer', cuota: 64500, total: 18, pagas: 9, vencidas: 0, mora: -4, op: 1, gestiones: [[0, 'plantilla', 'recordatorio', 'Recordatorio automático: vence en 4 días']] },
  { nombre: 'Héctor Gaitán', stage: 'por_vencer', cuota: 118000, total: 24, pagas: 2, vencidas: 0, mora: -5, op: 2 },
  { nombre: 'Rocío Albornoz', stage: 'por_vencer', cuota: 47800, total: 6, pagas: 5, vencidas: 0, mora: -6, op: 0 },
  // Mora temprana: sin contacto
  { nombre: 'Julián Barrios', stage: 'mora_temprana', cuota: 85000, total: 12, pagas: 6, vencidas: 1, mora: 4, op: 1, gestiones: [[-6, 'plantilla', 'recordatorio', 'Recordatorio automático de vencimiento'], [-2, 'whatsapp', 'sin_respuesta', 'Mensaje de mora temprana, sin respuesta']] },
  { nombre: 'Soledad Quiroga', stage: 'mora_temprana', cuota: 73200, total: 12, pagas: 3, vencidas: 1, mora: 9, op: 0, gestiones: [[-5, 'llamada', 'sin_respuesta', 'No atiende'], [-3, 'whatsapp', 'sin_respuesta', 'Mensaje de mora, leído sin respuesta']] },
  { nombre: 'Ezequiel Moreno', stage: 'mora_temprana', cuota: 156000, total: 24, pagas: 11, vencidas: 1, mora: 15, op: 2, gestiones: [[-10, 'whatsapp', 'sin_respuesta', 'Mensaje de mora temprana'], [-4, 'llamada', 'sin_respuesta', 'Buzón de voz']] },
  { nombre: 'Paula Heredia', stage: 'mora_temprana', cuota: 58900, total: 12, pagas: 7, vencidas: 2, mora: 27, op: 1, gestiones: [[-20, 'whatsapp', 'sin_respuesta', 'Mensaje de mora'], [-12, 'llamada', 'sin_respuesta', 'Número apagado'], [-3, 'plantilla', 'recordatorio', 'Plantilla de deuda con botón de baja']] },
  // Contactado
  { nombre: 'Martín Ocampo', stage: 'contactado', cuota: 99000, total: 18, pagas: 8, vencidas: 1, mora: 11, op: 0, gestiones: [[-7, 'whatsapp', 'sin_respuesta', 'Mensaje de mora'], [-1, 'whatsapp', 'contactado', 'Dice que cobra el 5 y ahí regulariza. Pidió el alias.']] },
  { nombre: 'Verónica Luna', stage: 'contactado', cuota: 67400, total: 12, pagas: 5, vencidas: 2, mora: 34, op: 2, gestiones: [[-25, 'whatsapp', 'sin_respuesta', 'Mensaje de mora'], [-10, 'llamada', 'contactado', 'Quedó sin trabajo, pide refinanciar. Se pasa a supervisor.']] },
  { nombre: 'Franco Aguirre', stage: 'contactado', cuota: 121000, total: 24, pagas: 13, vencidas: 1, mora: 6, op: 1, gestiones: [[-2, 'llamada', 'contactado', 'Reconoce la deuda, confirma pago esta semana']] },
  // Promesa de pago
  { nombre: 'Cecilia Ibáñez', stage: 'promesa', cuota: 88000, total: 12, pagas: 4, vencidas: 1, mora: 8, op: 0, promesa: [2, 88000], gestiones: [[-5, 'whatsapp', 'contactado', 'Respondió al mensaje de mora'], [-1, 'whatsapp', 'promesa', 'Promete pagar el viernes por transferencia al alias', 88000]] },
  { nombre: 'Ramón Villalba', stage: 'promesa', cuota: 142000, total: 24, pagas: 10, vencidas: 2, mora: 22, op: 1, promesa: [1, 284000], gestiones: [[-15, 'llamada', 'sin_respuesta', 'No atiende'], [-8, 'whatsapp', 'contactado', 'Pide unos días'], [0, 'llamada', 'promesa', 'Paga las dos cuotas mañana en Rapipago', 284000]] },
  { nombre: 'Agustina Pereyra', stage: 'promesa', cuota: 54000, total: 6, pagas: 3, vencidas: 1, mora: 3, op: 2, promesa: [4, 54000], gestiones: [[0, 'whatsapp', 'promesa', 'Paga el lunes con Mercado Pago', 54000]] },
  // Regularizado
  { nombre: 'Leandro Figueroa', stage: 'regularizado', cuota: 97000, total: 12, pagas: 7, vencidas: 0, mora: 0, op: 0, recuperado: 97000, gestiones: [[-9, 'whatsapp', 'promesa', 'Promete pagar el 20', 97000], [-3, 'sistema', 'pago', 'Pago acreditado por transferencia', 97000]] },
  { nombre: 'Daniela Suárez', stage: 'regularizado', cuota: 76500, total: 18, pagas: 12, vencidas: 0, mora: 0, op: 1, recuperado: 153000, gestiones: [[-12, 'llamada', 'promesa', 'Paga las dos cuotas atrasadas', 153000], [-6, 'sistema', 'pago', 'Pago acreditado en Rapipago', 153000]] },
  { nombre: 'Pablo Medina', stage: 'regularizado', cuota: 61000, total: 12, pagas: 9, vencidas: 0, mora: 0, op: 2, recuperado: 61000, gestiones: [[-4, 'whatsapp', 'contactado', 'Se había olvidado'], [-2, 'sistema', 'pago', 'Pago acreditado por Mercado Pago', 61000]] },
  // Mora tardía
  { nombre: 'Sergio Benítez', stage: 'mora_tardia', cuota: 110000, total: 24, pagas: 6, vencidas: 3, mora: 74, op: 2, gestiones: [[-60, 'whatsapp', 'sin_respuesta', 'Mensaje de mora'], [-40, 'llamada', 'sin_respuesta', 'Número apagado'], [-21, 'llamada', 'contactado', 'Promete pagar a fin de mes'], [-5, 'plantilla', 'recordatorio', 'Aviso de pase a gestión prejudicial']] },
  { nombre: 'Mónica Toledo', stage: 'mora_tardia', cuota: 83500, total: 12, pagas: 2, vencidas: 4, mora: 96, op: 0, gestiones: [[-90, 'whatsapp', 'sin_respuesta', 'Mensaje de mora'], [-60, 'llamada', 'sin_respuesta', 'No atiende'], [-30, 'llamada', 'sin_respuesta', 'No atiende'], [-7, 'sistema', 'cambio_etapa', 'Derivada a estudio de cobranza']] },
]

const cuentas: NuevaCuenta[] = S.map((s, i) => {
  const operador = OPERADORES[s.op]
  return {
    nombre: s.nombre,
    dni: String(28_100_000 + i * 731_457).replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    telefono: `54911000${String(3000 + i).padStart(5, '0')}`.slice(0, 13),
    nro_credito: `MH-${String(24100 + i * 37)}`,
    producto: s.cuota > 100000 ? 'Préstamo personal' : i % 3 === 0 ? 'Adelanto de sueldo' : 'Préstamo personal',
    cuota: s.cuota,
    cuotas_pagas: s.pagas,
    cuotas_total: s.total,
    cuotas_vencidas: s.vencidas,
    saldo_vencido: s.vencidas * s.cuota,
    dias_mora: Math.max(0, s.mora),
    vencimiento: fecha(-s.mora),
    stage: s.stage,
    operador,
    promesa_fecha: s.promesa ? fecha(s.promesa[0]) : null,
    promesa_monto: s.promesa ? s.promesa[1] : null,
    recuperado: s.recuperado ?? 0,
    gestiones: (s.gestiones ?? []).map(([d, canal, resultado, nota, monto], k) => ({ fecha: iso(d, 10 + k), canal, resultado, nota, operador: canal === 'sistema' || canal === 'plantilla' ? 'Sistema' : operador, monto: monto ?? null })),
    created_at: iso(-120 + i),
    updated_at: iso(s.gestiones?.length ? s.gestiones[s.gestiones.length - 1][0] : -1),
  }
})

async function main() {
  const s = cobranzas()
  await s.reset()
  await s.insertMany(cuentas)
  console.log(`cartera cargada: ${cuentas.length} cuentas`)
}
main().catch(e => { console.error(e); process.exit(1) })
