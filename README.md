# Demo · Agente de WhatsApp + CRM propio (créditos)

Demo para mostrar un agente conversacional que atiende consultas de crédito por
WhatsApp, califica al cliente y lo deja en un CRM propio con embudos de
verificación, cobranza y seguimiento. Negocio ficticio: **Créditos Río**.

## Correrla en local (sin configurar nada más que la clave de IA)

```bash
cp .env.example .env.local     # completar ANTHROPIC_API_KEY
npm install
npx tsx scripts/seed.ts        # carga 5 contactos ficticios
npm run dev                    # http://localhost:3000
```

Sin Supabase, los datos se guardan en `data/store.json`. El **Simulador**
(`/simulador`) manda mensajes por el mismo camino que WhatsApp, sin Meta.

## Pantallas

| Ruta | Qué muestra |
|---|---|
| `/tablero` | Kanban: Nuevo · Verificación · Cobranza · Seguimiento · No califica. Se refresca solo cada 5 s. |
| `/conversaciones` | Lista de hilos con último mensaje. |
| `/contactos/[id]` | Chat completo, ficha con los datos extraídos, calificación del sistema con sus razones, cambio de etapa, carga de cuota y botones de campañas (recordatorio de vencimiento, agradecimiento post-pago). |
| `/simulador` | Teléfono de mentira para probar el agente sin número real. |

## Cómo decide el sistema

- El agente (Claude) conversa y **extrae** datos: nombre, monto, destino,
  situación laboral, ingresos, edad, turno para la verificación.
- El **score lo calcula el código** (`src/lib/scoring.ts`), no la IA: edad,
  tipo de ingreso y relación cuota/ingreso. Las razones se muestran en la ficha.
- Un cliente que escribe por una cuota o deuda va directo a **Cobranza**; el
  agente no negocia.
- Todo lo que el agente sabe del negocio está en `src/lib/negocio.ts`.

## Producción (Vercel + Supabase + número de prueba de Meta)

1. **Supabase**: proyecto nuevo, pegar `supabase/schema.sql` en el SQL Editor.
   Copiar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
2. **Meta**: en developers.facebook.com crear una app (tipo Business) y agregar
   el producto WhatsApp. En *API Setup* aparece el **número de prueba** con su
   `Phone number ID` y un token temporal (24 h; para la demo conviene generar
   un token de sistema permanente desde Business Settings → System users).
   En *To*, agregar el celular de la persona que va a probar (admite hasta 5).
3. **Vercel**: `vercel` desde esta carpeta, cargar las variables de
   `.env.example` en el proyecto y desplegar.
4. **Webhook**: en la app de Meta → WhatsApp → Configuration → Webhook:
   URL `https://<tu-deploy>.vercel.app/api/whatsapp/webhook`, verify token igual
   a `WHATSAPP_VERIFY_TOKEN`, y suscribirse al campo `messages`.
5. Cargar datos ficticios contra Supabase:
   `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts`.

Limitación del número de prueba: solo puede escribirle a los números cargados
como destinatarios, y fuera de la ventana de 24 h desde el último mensaje del
cliente solo se pueden mandar plantillas aprobadas. Para la demo alcanza con que
el cliente escriba primero.

## Estructura

```
src/lib/negocio.ts        datos del negocio ficticio y plantillas
src/lib/scoring.ts        calificación determinística
src/lib/agent/            prompt y llamada a Claude (salida estructurada)
src/lib/pipeline.ts       camino único de un mensaje entrante
src/lib/whatsapp.ts       Cloud API de Meta
src/lib/db.ts             Supabase o JSON local, misma interfaz
src/app/api/whatsapp/     webhook (GET verificación, POST mensajes)
src/app/api/chat/         simulador
src/app/{tablero,conversaciones,contactos,simulador}/
scripts/seed.ts           contactos ficticios
supabase/schema.sql       esquema
```
