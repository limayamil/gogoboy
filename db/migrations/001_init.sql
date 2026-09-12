-- GoGoBoy: esquema inicial.
-- App de un solo usuario: no hay tabla de usuarios ni columna user_id.

create extension if not exists "pgcrypto";

create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  color_key  text        not null,
  position   integer     not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id              uuid primary key default gen_random_uuid(),
  -- Nullable a proposito: al borrar una categoria sus tareas sobreviven sin categoria.
  category_id     uuid references categories (id) on delete set null,
  title           text        not null,
  description     text,
  notes           text,
  urgency         text        not null default 'media'
                  check (urgency in ('baja', 'media', 'alta')),
  deadline        date,
  status          text        not null default 'pendiente'
                  check (status in ('pendiente', 'en_progreso', 'hecha')),
  -- El "ojito": ocultar NO desmarca in_today, solo saca la tarea de la vista Hoy.
  -- Nada limpia in_today al cambiar el dia; las tareas no vencen solas.
  in_today        boolean     not null default false,
  hidden_in_today boolean     not null default false,
  today_position  integer,
  position        integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table if not exists subtasks (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid    not null references tasks (id) on delete cascade,
  title    text    not null,
  done     boolean not null default false,
  position integer not null default 0
);

create table if not exists quick_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null,
  done       boolean     not null default false,
  position   integer     not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid        not null references tasks (id) on delete cascade,
  object_key   text        not null,
  file_name    text        not null,
  content_type text        not null,
  size_bytes   integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists tasks_category_idx on tasks (category_id, position);
create index if not exists tasks_today_idx    on tasks (in_today, today_position);
create index if not exists tasks_deadline_idx on tasks (deadline) where deadline is not null;
create index if not exists subtasks_task_idx  on subtasks (task_id, position);
create index if not exists attachments_task_idx on attachments (task_id);
