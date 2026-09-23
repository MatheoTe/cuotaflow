-- Esquema de la demo. Pegar en el SQL Editor de Supabase y ejecutar.
create extension if not exists pgcrypto;

create table if not exists contacts (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null unique,
  name            text,
  tipo            text not null default 'cliente' check (tipo in ('cliente','vendedor')),
  sucursal        text,
  stage           text not null default 'nuevo' check (stage in ('nuevo','verificacion','cobranza','seguimiento','rechazado')),
  score           integer not null default 0,
  datos           jsonb not null default '{}'::jsonb,
  resumen         text,
  proximo_paso    text,
  vencimiento     date,
  cuota           numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  direction   text not null check (direction in ('in','out')),
  kind        text not null default 'text' check (kind in ('text','imagen','recordatorio','agradecimiento','sistema')),
  body        text not null,
  wa_id       text unique,
  media_id    uuid,
  created_at  timestamptz not null default now()
);

-- Fotos recibidas por WhatsApp (base64). Para la demo alcanza; en producción va a Storage.
create table if not exists media (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  mime        text not null,
  data        text not null,
  created_at  timestamptz not null default now()
);

-- Consultas que un vendedor manda en nombre de un cliente.
create table if not exists consultas (
  id                uuid primary key default gen_random_uuid(),
  vendedor_id       uuid not null references contacts(id) on delete cascade,
  nombre_cliente    text,
  dni               text,
  banco             text,
  monto             numeric,
  telefono_cliente  text,
  completa          boolean not null default false,
  bureau            jsonb,
  score             integer not null default 0,
  stage             text not null default 'nuevo' check (stage in ('nuevo','verificacion','cobranza','seguimiento','rechazado')),
  resumen           text,
  proximo_paso      text,
  fotos             jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists consultas_vendedor_idx on consultas(vendedor_id, created_at desc);

create index if not exists messages_contact_idx on messages(contact_id, created_at);
create index if not exists contacts_last_message_idx on contacts(last_message_at desc);

-- La app usa la service role key desde el servidor; RLS queda prendida para que
-- la anon key no vea nada.
alter table contacts enable row level security;
alter table messages enable row level security;
alter table media enable row level security;
alter table consultas enable row level security;
-- Embudo de cobranzas: una fila por crédito con cuotas a cobrar.
create table if not exists cobranzas (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  dni              text,
  telefono         text,
  nro_credito      text not null,
  producto         text not null default 'Préstamo personal',
  cuota            numeric not null,
  cuotas_pagas     integer not null default 0,
  cuotas_total     integer not null,
  cuotas_vencidas  integer not null default 0,
  saldo_vencido    numeric not null default 0,
  dias_mora        integer not null default 0,
  vencimiento      date,
  stage            text not null default 'por_vencer' check (stage in ('por_vencer','mora_temprana','contactado','promesa','regularizado','mora_tardia')),
  operador         text,
  promesa_fecha    date,
  promesa_monto    numeric,
  recuperado       numeric not null default 0,
  gestiones        jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists cobranzas_stage_idx on cobranzas(stage, dias_mora desc);
alter table cobranzas enable row level security;
