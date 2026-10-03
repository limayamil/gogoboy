-- Bandeja: lo que el bot propone y todavia no es una tarea.
-- Tabla aparte a proposito. Una columna en tasks habria que filtrarla en Hoy,
-- Semana, Categorias y en el tool `tareas`; un olvido la mete en el tablero.
-- No hay estado aceptada/descartada: aceptar o tirar borra la fila, y la misma
-- origen_clave puede proponer de nuevo porque la clave ya no esta.

create table if not exists proposals (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null,
  description   text,
  urgency       text        not null default 'media'
                check (urgency in ('baja', 'media', 'alta')),
  deadline      date,
  -- El nombre se guarda siempre, para mostrar la sugerencia si el id desaparece.
  category_name text,
  -- Puntero a una categoria que ya existe. No autoriza al bot a crearla.
  -- on delete set null: si Yamil borra la lista, queda el nombre.
  category_id   uuid references categories (id) on delete set null,
  origen        text,
  origen_url    text,
  -- Unica entre pendientes. Null no choca: sin clave, cada proponer inserta.
  origen_clave  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists proposals_origen_clave_key
  on proposals (origen_clave)
  where origen_clave is not null;
