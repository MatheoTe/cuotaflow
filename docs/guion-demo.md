# Guion de la demo

Duración: 10 minutos. Todo corre en el deploy de la demo (o en `npm run dev`).
Abrí dos pestañas: **/tablero** y **/simulador**. Si ya hay número de Meta,
en vez del simulador se puede escribir desde un celular a la línea de prueba.

## 1. El caso de él: un vendedor pasa una consulta (4 min)

En el simulador, botón **Soy vendedor**.

1. Escribí: `Hola Sofi, te paso una consulta. Cliente Gutierrez Pablo, DNI 40123456, quiere 500 mil`
   → pide el único dato que falta (el banco).
2. `cobra en el Galicia`
   → el sistema califica (situación 1) y contesta pre-aprobado hasta 1,5 M.
   Mostrá el **tablero**: la consulta apareció en Verificación con el score.
3. `el tel es 11 0000 4433`
   → lo carga en la misma consulta, no abre otra.
4. Clip → adjuntá `public/demo/dni-ficticio.png` con el texto `te paso esta, cobra por el Santander`
   → lee nombre y DNI de la foto. Abrí la consulta en el tablero: foto adjunta, datos, razones del score.
5. `otra: Choque Daniel dni 30111222 Macro 900 mil`
   → situación 3 con deuda: no pre-aprueba, queda "A revisar" para un analista.

Remate: "esto reemplaza el mail. El vendedor manda lo mismo que hoy, por WhatsApp,
y en vez de que lo levantes vos a mano, el sistema lo carga, lo califica y le
contesta al vendedor en el momento. Vos ves todo en el tablero."

## 2. El cliente final (2 min)

Botón **Soy cliente**. `hola, necesito plata` → nombre → `unos 800 mil para una obra` →
`soy monotributista` → `gano como 1 palo y medio` → `41` → `el jueves a la tarde`.
Califica de a un dato, agenda la verificación, un "gracias" después no reabre nada.

## 3. Cobranza y campañas (2 min)

Con otro número: `hola soy Carla, tengo un préstamo y no me llegó el link para pagar`
→ deriva a cobranza sin negociar. En la ficha de Marcos Peralta (tablero, columna
Cobranza) mostrá los botones **Recordatorio de vencimiento** y **Agradecimiento post-pago**.

## Cosas para decir si pregunta

- **El bureau es simulado.** Hoy la situación crediticia sale de una regla fija por
  DNI para que la demo sea repetible. En producción ahí se conecta la consulta real
  (BCRA, Veraz o el proveedor que use él). Está marcado en pantalla.
- **La calificación la hace el código, no la IA.** La IA extrae datos y redacta;
  las reglas de score son suyas y se cambian sin tocar la IA.
- **Líneas:** la misma app atiende todas las líneas que den de alta en Meta; cada
  vendedor y cada cliente entra por el número al que le escribió.
- **Fotos:** entran por WhatsApp, quedan adjuntas a la consulta y la IA las lee.
  En producción van a un almacenamiento con acceso restringido.
- **Los datos de la demo son inventados**, incluido el DNI de la foto.

## Antes de la reunión

- Correr `npx tsx scripts/seed.ts --reset` contra Supabase si el tablero quedó sucio.
- Si el número de Meta ya está: mandar un mensaje de prueba desde tu celular y
  confirmar que responde.
