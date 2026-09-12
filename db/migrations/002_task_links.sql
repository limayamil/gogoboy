-- Links de una tarea. No son adjuntos: no viven en el bucket, son datos, asi que
-- van en su propia tabla en vez de ensuciar `attachments` con filas sin object_key.
create table if not exists task_links (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid        not null references tasks (id) on delete cascade,
  url        text        not null,
  title      text,
  position   integer     not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists task_links_task_idx on task_links (task_id, position);
