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
