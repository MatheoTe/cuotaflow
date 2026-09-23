# Reunión con Juan Manuel Silva (Comarfin Mutual)

Objetivo de la reunión: que Juan vea funcionando lo que pidió en los audios y
salga con el alcance de Meta claro. Cierre buscado: arrancar con Meta ya (lo
propuso él) y fijar fecha para el agente con CRM propio.

## 1. Orden sugerido (30 min)

1. **Demo, 10 min.** Antes de hablar de nada. Guion en `docs/guion-demo.md`.
   Empezar por el caso del vendedor, que es lo que él describió.
2. **Sus tres preguntas, 5 min.** Respuestas abajo, cortas.
3. **Meta, 10 min.** Qué es la verificación, qué le pido, qué cubre el mensual.
4. **Cierre, 5 min.** Qué arranca ahora y qué queda para después.

## 2. Lo que pidió en los audios y cómo se responde

| Pidió | Qué mostrar | Frase |
|---|---|---|
| Ver un CRM andando | Dashboard y pipeline | "Esto es un CRM propio, no una licencia. Es de ustedes." |
| Que la consulta llegue por WhatsApp en vez de mail y el sistema conteste | Simulador como vendedor: nombre, DNI, banco | "El vendedor manda lo mismo que hoy, por WhatsApp. El sistema carga, califica y le contesta ahí mismo." |
| Adjuntos como foto | Foto del DNI ficticio | "Le manda la foto del DNI y el sistema lee nombre y número de la foto." |
| "Tipo formulario" que califique y responda | `/consulta` | "Y si algún vendedor prefiere un formulario, es el mismo motor." |
| Sumar líneas | Explicación, no demo | "Las líneas son de ustedes; cada una se da de alta en Meta y el mismo sistema las atiende a todas. El alta la hago yo." |

## 3. Respuestas a sus preguntas

**"¿Podemos sumar líneas? ¿Hay sistemas que generan números?"**
Los números se compran a cualquier proveedor (físicos o virtuales). Lo que no
existe es un sistema que "genere" números legítimos: los servicios que hacen eso
usan líneas sin verificar y son las que Meta banea. Con el portafolio
verificado, cada línea nueva es un alta en Meta que hago yo, y el CRM las
atiende a todas desde el mismo tablero. Tres, cuatro o cinco líneas no cambian
el precio del agente.

**"¿La consulta puede entrar por WhatsApp y que el sistema responda por el mismo medio?"**
Sí, es exactamente lo que vio en la demo. El vendedor escribe a la línea, el
sistema califica y le contesta en segundos. El mail desaparece.

**"¿Los adjuntos como foto?"**
Sí. Las fotos entran por WhatsApp, quedan pegadas a la consulta en el CRM y la
IA las lee. En producción se guardan en un almacenamiento con acceso
restringido y se puede definir cuánto tiempo se conservan.

## 4. Meta: lo que hay que dejarle claro

**Qué es verificar el negocio.** Meta pide demostrar que Comarfin Mutual
existe: razón social, CUIT, domicilio, y un documento oficial que los muestre
(constancia de inscripción, factura de servicio o estatuto). Con eso el número
sale del modo restringido y puede hablar con cualquier cliente.

**Por qué hoy se les bloquea la cuenta.** Un número sin verificar, mandando
difusiones a gente que no escribió primero, es la definición de spam para Meta.
Los bloqueos cada diez minutos no son mala suerte: son el sistema haciendo lo
que está diseñado para hacer. Se corrige con verificación, plantillas
aprobadas y el botón de baja.

**Qué le pido a Juan para arrancar.**
- Acceso de administrador a su Meta Business (o crear uno nuevo y limpio).
- CUIT y constancia de inscripción de la mutual.
- Qué números quieren usar y a nombre de quién están.
- Quién es el contacto para las apelaciones si algo se cae.

**Qué cubre el mensual de USD 100.** Monitoreo del estado de la cuenta y de
cada línea, plantillas de difusión aprobadas, botón de baja para no juntar
denuncias, altas de líneas nuevas, portafolio de reserva, y la apelación y
migración si Meta restringe algo. Es un seguro, no un trámite.

**Límites que conviene decir antes de que los descubra.**
- Con un número nuevo, Meta limita cuántas conversaciones nuevas por día se
  pueden iniciar (arranca en 250 y sube solo si la calidad se mantiene).
  Responder a quien escribe no tiene límite.
- Después de 24 horas sin respuesta del cliente, solo se le puede escribir con
  una plantilla aprobada. Los recordatorios de vencimiento se hacen así.
- Meta cobra por conversación iniciada por la empresa (centavos de dólar, según
  categoría). Responder mensajes del cliente es gratis dentro de las 24 horas.

## 5. Lo que es demo y lo que es producción

Si pregunta, decirlo antes que él lo note:
- **El bureau es simulado.** La situación crediticia sale de una regla fija para
  que la demo sea repetible. En producción se conecta la fuente real (BCRA,
  Veraz o el proveedor que usen). Está marcado en pantalla.
- **La calificación la define él.** Hoy es edad, tipo de ingreso y relación
  cuota/ingreso para clientes, y situación crediticia + banco + monto para
  consultas. Son reglas de código, se cambian sin tocar la IA.
- **Los datos son inventados**, incluido el DNI de la foto.
- **El número de prueba** solo le responde a los celulares cargados (hasta 5).
  Con el número real de ellos no hay ese límite.

## 6. Precios (de las propuestas del 10/09)

| | Setup | Mensual |
|---|---|---|
| Gestión de Meta Business | USD 250 | USD 100 |
| Agente a medida + CRM propio | USD 1.595 | USD 340 |

Cierre natural: Meta arranca ya (él lo propuso), y el agente con CRM propio
tiene fecha de inicio en cuanto tengan la verificación en marcha, porque el
agente necesita la cuenta sana para salir a producción.

## 7. Preguntas que le podés hacer para cerrar el alcance

- Cuántos vendedores mandan consultas hoy y cuántas por día.
- Qué chequean hoy cuando les llega una consulta (bureau, recibo, referencias).
- Qué pasa después de aprobar: quién llama al cliente, quién desembolsa.
- Si quieren que el cliente final también pueda escribir a la línea, o solo
  vendedores.
- Quién va a mirar el tablero todos los días.

## 8. Checklist antes de entrar

- [ ] Tablero limpio: `npx tsx scripts/seed.ts --reset` contra Supabase.
- [ ] El número de prueba responde a tu celular (mandá "hola").
- [ ] El celular de Juan cargado como destinatario y confirmado con su código.
- [ ] Pestañas abiertas: dashboard, simulador, formulario.
- [ ] La foto `public/demo/dni-ficticio.png` a mano para adjuntar.
