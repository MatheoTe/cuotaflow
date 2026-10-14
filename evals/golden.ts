import type { Caso } from './tipos'

/**
 * Golden set: conversaciones ficticias con el resultado que el negocio espera.
 * Teléfonos con el número local empezando en 0 (no existen) y DNIs elegidos
 * para caer en cada situación del bureau simulado.
 */
const V = '5493880000001' // vendedor conocido (src/lib/negocio.ts)

export const GOLDEN: Caso[] = [
  {
    id: 'cliente-califica-dependencia',
    descripcion: 'Empleada en relación de dependencia, cuota holgada: pre-aprobada y con turno de verificación',
    telefono: '5491100009001',
    mensajes: ['hola, necesito plata', 'Lucía', 'unos 600 mil para arreglar el auto', 'trabajo en relación de dependencia', 'cobro como 1.100.000', '34', 'mañana a la mañana me viene bien'],
    esperado: 'califica',
    grabadas: [
      { reply: 'Hola, soy Sofi. Te ayudo con eso. ¿Cómo te llamás?' },
      { reply: 'Un gusto, Lucía. ¿Qué monto necesitás?', datos: { nombre: 'Lucía' } },
      { reply: '¿Trabajás en relación de dependencia, sos monotributista, jubilada o tenés ingresos informales?', datos: { monto_solicitado: 600_000, destino: 'arreglar el auto' } },
      { reply: '¿Cuánto ingresás por mes, más o menos?', datos: { situacion_laboral: 'relacion_dependencia' } },
      { reply: '¿Qué edad tenés?', datos: { ingresos_mensuales: 1_100_000 } },
      { reply: 'Quedás pre-aprobada. Falta una verificación telefónica de 5 minutos: ¿qué día y franja te viene bien?', datos: { edad: 34 }, stage: 'verificacion' },
      { reply: 'Listo, Lucía. Te llaman mañana a la mañana. Tené el DNI a mano.', datos: { turno_verificacion: 'mañana a la mañana' }, stage: 'verificacion', proximo_paso: 'Llamar mañana a la mañana' },
    ],
  },
  {
    id: 'cliente-califica-cuota-ajustada',
    descripcion: 'En blanco pero la cuota queda ajustada: se sugiere menos monto y sigue a verificación',
    telefono: '5491100009002',
    mensajes: ['necesito 3 millones', 'Lucas', 'para un auto', 'trabajo en blanco', 'cobro 500 mil', '30'],
    esperado: 'califica',
    grabadas: [
      { reply: 'Hola, soy Sofi. ¿Cómo te llamás?', datos: { monto_solicitado: 3_000_000 } },
      { reply: 'Gracias, Lucas. ¿Para qué lo necesitás?', datos: { nombre: 'Lucas' } },
      { reply: '¿Trabajás en relación de dependencia, sos monotributista o jubilado?', datos: { destino: 'auto' } },
      { reply: '¿Cuánto cobrás por mes, aproximado?', datos: { situacion_laboral: 'relacion_dependencia' } },
      { reply: '¿Qué edad tenés?', datos: { ingresos_mensuales: 500_000 } },
      { reply: 'Con ese ingreso la cuota de 3 millones queda ajustada; te conviene un monto menor o más plazo, y lo vemos en una verificación de 5 minutos. ¿Qué día te llamamos?', datos: { edad: 30 }, stage: 'verificacion', proximo_paso: 'Ofrecer menos monto en la llamada' },
    ],
  },
  {
    id: 'cliente-no-califica-sin-ingresos',
    descripcion: 'Sin trabajo y cobra un plan: completa los seis datos y recién ahí no califica',
    telefono: '5491100009003',
    mensajes: ['hola, quiero un préstamo de 2 millones', 'Tomás', 'para un viaje', 'no tengo trabajo ahora, cobro un plan', 'como 250 mil', '19'],
    esperado: 'no_califica',
    grabadas: [
      { reply: 'Hola, soy Sofi. ¿Cómo te llamás?', datos: { monto_solicitado: 2_000_000 } },
      { reply: 'Gracias, Tomás. ¿Para qué lo necesitás?', datos: { nombre: 'Tomás' } },
      { reply: '¿Trabajás en relación de dependencia, sos monotributista o tenés ingresos informales?', datos: { destino: 'viaje' } },
      { reply: 'Entiendo. ¿Cuánto ingresás por mes con el plan?', datos: { situacion_laboral: 'desempleado' } },
      { reply: '¿Qué edad tenés?', datos: { ingresos_mensuales: 250_000 } },
      { reply: 'Gracias por contarme, Tomás. Sin ingresos demostrables hoy no te lo puedo pre-aprobar. Si querés, un verificador revisa tu caso.', datos: { edad: 19 }, stage: 'rechazado' },
    ],
  },
  {
    id: 'cliente-faltan-datos',
    descripcion: 'Dio monto y nombre pero todavía no la situación laboral: el agente pide el siguiente dato',
    telefono: '5491100009004',
    mensajes: ['buenas, necesito 250 lucas para una deuda de tarjeta', 'Rodrigo'],
    esperado: 'pide_datos',
    grabadas: [
      { reply: 'Hola, soy Sofi. Te ayudo. ¿Cómo es tu nombre?', datos: { monto_solicitado: 250_000, destino: 'deuda de tarjeta' } },
      { reply: 'Gracias, Rodrigo. ¿Trabajás en relación de dependencia, sos monotributista, jubilado o tenés ingresos informales?', datos: { nombre: 'Rodrigo' } },
    ],
  },
  {
    id: 'guarda-veredicto-prematuro',
    descripcion: 'El modelo da un rechazo antes de tener los seis datos: la guarda lo vuelve a "nuevo"',
    telefono: '5491100009005',
    mensajes: ['hola necesito plata', 'no tengo trabajo'],
    esperado: 'pide_datos',
    grabadas: [
      { reply: 'Hola, soy Sofi. ¿Cómo te llamás?' },
      // Salida "mala" a propósito: veredicto con datos incompletos.
      { reply: 'Entiendo. ¿Cuánto ingresás por mes, aunque sea aproximado?', datos: { situacion_laboral: 'desempleado' }, stage: 'rechazado' },
    ],
  },
  {
    id: 'cliente-cuota-a-cobranza',
    descripcion: 'Cliente con una cuota: no se negocia, se deriva al sector de cobranza',
    telefono: '5491100009006',
    mensajes: ['hola soy Carla, tengo un préstamo y no me llegó el link para pagar la cuota'],
    esperado: 'deriva_humano',
    grabadas: [
      { reply: 'Hola Carla, soy Sofi. Le paso tu caso al sector de cobranza y te escriben en el horario de atención.', datos: { nombre: 'Carla', es_cliente_con_cuota: true }, stage: 'cobranza', proximo_paso: 'Cobranza le manda el medio de pago' },
    ],
  },
  {
    id: 'cliente-pide-revision-humana',
    descripcion: 'No califica, pide que lo revise una persona: queda en verificación como revisión manual',
    telefono: '5491100009007',
    mensajes: ['quiero 1 millón y medio', 'Brian', 'para un negocio', 'hago changas', '300 mil', '22', 'me lo puede revisar una persona?'],
    esperado: 'deriva_humano',
    grabadas: [
      { reply: 'Hola, soy Sofi. ¿Cómo te llamás?', datos: { monto_solicitado: 1_500_000 } },
      { reply: '¿Para qué lo necesitás, Brian?', datos: { nombre: 'Brian' } },
      { reply: '¿Trabajás en relación de dependencia, sos monotributista o tenés ingresos informales?', datos: { destino: 'negocio' } },
      { reply: '¿Cuánto ingresás por mes?', datos: { situacion_laboral: 'informal' } },
      { reply: '¿Qué edad tenés?', datos: { ingresos_mensuales: 300_000 } },
      { reply: 'Te soy sincera: con ingresos informales de 300 mil la cuota no entra y hoy no te lo puedo pre-aprobar.', datos: { edad: 22 }, stage: 'rechazado' },
      { reply: 'Sí, claro. Dejo tu caso para que lo revise un verificador y te escribe en el horario de atención.', stage: 'verificacion', proximo_paso: 'revisión manual' },
    ],
  },
  {
    id: 'vendedor-califica',
    descripcion: 'Vendedor pasa una consulta completa de alguien en situación 1: pre-aprobado',
    telefono: V,
    mensajes: ['Hola Sofi, te paso una consulta. Cliente Gutierrez Pablo, DNI 40123456, quiere 500 mil', 'cobra en el Galicia'],
    esperado: 'califica',
    grabadas: [
      { rol: 'vendedor', stage: 'seguimiento', reply: '¿En qué banco cobra Pablo?', consulta: { nombre_cliente: 'Gutierrez Pablo', dni: '40123456', monto: 500_000 } },
      { rol: 'vendedor', stage: 'seguimiento', reply: '(borrador)', consulta: { banco: 'Banco Galicia' } },
      { rol: 'vendedor', stage: 'seguimiento', reply: 'Pablo Gutierrez está en situación 1 y cobra por Galicia: pre-aprobado hasta $1.500.000. ¿Me pasás su teléfono para la verificación?', consulta: {} },
    ],
  },
  {
    id: 'vendedor-falta-banco',
    descripcion: 'Vendedor manda nombre y DNI sin banco: se pide solo el banco y no se califica todavía',
    telefono: V,
    mensajes: ['consulta: Flores Marta, DNI 12345678, 250 mil'],
    esperado: 'pide_datos',
    grabadas: [
      { rol: 'vendedor', stage: 'seguimiento', reply: '¿En qué banco cobra Marta?', consulta: { nombre_cliente: 'Flores Marta', dni: '12345678', monto: 250_000 } },
    ],
  },
  {
    id: 'vendedor-situacion-3-a-analista',
    descripcion: 'Situación 3 con deuda: no pre-aprueba, queda para un analista',
    telefono: V,
    mensajes: ['otra: Choque Daniel dni 30111222 Macro 900 mil'],
    esperado: 'deriva_humano',
    grabadas: [
      { rol: 'vendedor', stage: 'seguimiento', reply: '(borrador)', consulta: { nombre_cliente: 'Choque Daniel', dni: '30111222', banco: 'Banco Macro', monto: 900_000, consulta_nueva: true } },
      { rol: 'vendedor', stage: 'seguimiento', reply: 'Daniel Choque figura en situación 3 con deuda informada. No lo puedo pre-aprobar por 900 mil; lo revisa un analista.', consulta: {} },
    ],
  },
  {
    id: 'vendedor-situacion-5-no-califica',
    descripcion: 'Situación 5 (deuda en gestión judicial): no califica',
    telefono: V,
    mensajes: ['te paso otra: Ramírez Hugo, DNI 27314825, cobra en Banco Macro, quiere 700 mil'],
    esperado: 'no_califica',
    grabadas: [
      { rol: 'vendedor', stage: 'seguimiento', reply: '(borrador)', consulta: { nombre_cliente: 'Ramírez Hugo', dni: '27314825', banco: 'Banco Macro', monto: 700_000, consulta_nueva: true } },
      { rol: 'vendedor', stage: 'seguimiento', reply: 'Hugo Ramírez está en situación 5, con deuda en gestión judicial: no califica. Si querés, lo mira un analista.', consulta: {} },
    ],
  },
]
