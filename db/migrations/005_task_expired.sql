-- Vencimiento semanal de tareas hechas. Distinto del ojito (`hidden_in_today`):
-- al cerrar la semana (lunes a domingo, zona GOGOBOY_TZ o America/Argentina/Buenos_Aires)
-- las hechas dejan de listarse en Hoy y Categorias. Semana las sigue mostrando
-- para mirar atras. El default es false: cargar el estado las marca lazy.
alter table tasks
  add column if not exists expired boolean not null default false;

create index if not exists tasks_expired_idx on tasks (expired) where expired = true;
