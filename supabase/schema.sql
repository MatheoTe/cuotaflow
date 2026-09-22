-- Esquema de la demo. Pegar en el SQL Editor de Supabase y ejecutar.
create extension if not exists pgcrypto;

create table if not exists contacts (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null unique,
  name            text,
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
  kind        text not null default 'text' check (kind in ('text','recordatorio','agradecimiento','sistema')),
  body        text not null,
  wa_id       text unique,
  created_at  timestamptz not null default now()
);

create index if not exists messages_contact_idx on messages(contact_id, created_at);
create index if not exists contacts_last_message_idx on contacts(last_message_at desc);

-- La app usa la service role key desde el servidor; RLS queda prendida para que
-- la anon key no vea nada.
alter table contacts enable row level security;
alter table messages enable row level security;
