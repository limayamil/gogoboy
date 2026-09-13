-- Contraseñas viven en `notes` con un kind reservado. No son una etiqueta:
-- el usuario no deberia poder borrarlas ni mezclarlas con tags libres.

alter table notes
  add column if not exists kind text not null default 'note';

alter table notes
  add column if not exists username text;

alter table notes
  add column if not exists password text;

alter table notes drop constraint if exists notes_kind_chk;

alter table notes
  add constraint notes_kind_chk check (kind in ('note', 'password'));

-- Una nota comun no guarda credenciales; una contraseña siempre tiene clave.
alter table notes drop constraint if exists notes_password_fields_chk;

alter table notes
  add constraint notes_password_fields_chk check (
    (kind = 'note' and username is null and password is null)
    or (kind = 'password' and password is not null)
  );
