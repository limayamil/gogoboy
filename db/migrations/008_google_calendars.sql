-- Cuentas de Google conectadas por OAuth (calendarios de Workspace sin direccion iCal).
-- Tablas nuevas: no toca meet_calendars ni nada existente.
-- refresh_token_enc va cifrado con AES-256-GCM (GOOGLE_TOKEN_KEY); el token no sale del servidor.
create table if not exists google_accounts (
  id                uuid primary key default gen_random_uuid(),
  email             text        not null unique,
  refresh_token_enc text        not null,
  -- 'reconectar' cuando Google rechaza el token: la cuenta queda, pero no se consulta.
  status            text        not null default 'ok' check (status in ('ok', 'reconectar')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Los calendarios que Yamil eligio mostrar de cada cuenta. Desconectar la cuenta los borra.
create table if not exists google_calendars (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid        not null references google_accounts (id) on delete cascade,
  calendar_id text        not null,
  name        text        not null,
  color_key   text        not null,
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  unique (account_id, calendar_id)
);
