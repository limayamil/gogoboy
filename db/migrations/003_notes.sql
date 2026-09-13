-- Notas: entidad propia, etiquetas simples (sin color) y adjuntos compartidos
-- con las tareas. Las categorias de tareas no se reusan a proposito.

create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists note_tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

-- Mismo nombre con distinta capitalizacion es la misma etiqueta.
create unique index if not exists note_tags_name_lower_idx on note_tags (lower(name));

create table if not exists note_tag_assignments (
  note_id uuid not null references notes (id) on delete cascade,
  tag_id  uuid not null references note_tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create index if not exists note_tag_assignments_tag_idx on note_tag_assignments (tag_id);

-- Un adjunto es de una tarea o de una nota, nunca de las dos.
alter table attachments alter column task_id drop not null;

alter table attachments
  add column if not exists note_id uuid references notes (id) on delete cascade;

alter table attachments drop constraint if exists attachments_owner_chk;

alter table attachments
  add constraint attachments_owner_chk check (
    (task_id is not null and note_id is null)
    or (task_id is null and note_id is not null)
  );

create index if not exists attachments_note_idx on attachments (note_id);
