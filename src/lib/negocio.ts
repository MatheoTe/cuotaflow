/**
 * Datos del negocio ficticio que atiende el agente.
 * Todo lo que el agente "sabe" del negocio sale de acá: cambiá este archivo
 * para adaptar la demo a otro rubro sin tocar el código.
 */
export const NEGOCIO = {
  nombre: 'Créditos Río',
  agente: 'Sofi',
  horario: 'lunes a viernes de 9 a 18 h',
  productos: [
    { nombre: 'Préstamo personal', montoMin: 100_000, montoMax: 3_000_000, cuotas: '3 a 24 cuotas fijas' },
    { nombre: 'Adelanto de sueldo', montoMin: 50_000, montoMax: 500_000, cuotas: '1 a 3 cuotas' },
  ],
  requisitos: [
    'Ser mayor de 18 años',
    'DNI argentino',
    'Ingresos demostrables (recibo de sueldo, monotributo o jubilación)',
    'Cuenta bancaria propia para acreditar el dinero',
  ],
  /** Cuánto puede representar la cuota sobre el ingreso mensual. */
  relacionCuotaIngreso: 0.3,
  /** Qué respuesta dar si preguntan por tasas. */
  tasas: 'La tasa depende del perfil y del plazo; te la confirma el verificador en la llamada, con el costo total y la cuota exacta.',
  cobranza: {
    nombre: 'Sector de cobranza',
    cbu: 'alias CREDITOS.RIO.PAGOS',
    medios: 'transferencia al alias CREDITOS.RIO.PAGOS, Mercado Pago o Rapipago con el número de cliente',
  },
} as const

/**
 * Vendedores conocidos por teléfono. Un número que no esté acá también puede
 * mandar una consulta: el agente lo reconoce por el contenido y lo marca como vendedor.
 */
export const VENDEDORES: Array<{ phone: string; nombre: string; sucursal: string }> = [
  { phone: '5493885000001', nombre: 'Ramiro Quispe', sucursal: 'La Quiaca' },
  { phone: '5491155550002', nombre: 'Vendedor de prueba', sucursal: 'Sucursal demo' },
]

export const ETAPAS = ['nuevo', 'verificacion', 'cobranza', 'seguimiento', 'rechazado'] as const
export type Etapa = (typeof ETAPAS)[number]

export const ETAPA_LABEL: Record<Etapa, string> = {
  nuevo: 'Nuevo',
  verificacion: 'Verificación',
  cobranza: 'Cobranza',
  seguimiento: 'Seguimiento',
  rechazado: 'No califica',
}

export const PLANTILLAS = {
  recordatorio_vencimiento: (nombre: string, fecha: string, monto: string) =>
    `Hola ${nombre}, te escribimos de ${NEGOCIO.nombre}. Te recordamos que tu cuota de ${monto} vence el ${fecha}. Podés pagarla por ${NEGOCIO.cobranza.medios}. Si ya la pagaste, ignorá este mensaje. ¡Gracias!`,
  agradecimiento_pago: (nombre: string) =>
    `¡Gracias ${nombre}! Registramos tu pago en ${NEGOCIO.nombre}. Cualquier consulta, escribinos por acá.`,
} as const
