-- Calendarios de Google para la barra de Meets del día. Tabla nueva: no toca nada existente.
-- ical_url es la direccion secreta iCal; la lee solo el servidor y ninguna respuesta la incluye.
create table if not exists meet_calendars (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  color_key  text        not null,
  ical_url   text        not null,
  position   integer     not null default 0,
  created_at timestamptz not null default now()
);
