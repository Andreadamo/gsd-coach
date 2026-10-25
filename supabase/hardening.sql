-- GSD Coach — hardening (eseguire dopo schema.sql, feedback.sql, partite.sql, rosa.sql)

-- owner_id immutabile (tranne admin): l'update è aperto a tutto lo staff su esercizi, partite e rosa,
-- quindi senza questo un mister potrebbe intestarsi una riga altrui e poi cancellarla
create or replace function public.lock_owner() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id and not public.is_admin() then
    raise exception 'owner_id non modificabile';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['exercises','sessions','cycles','matches','players','evaluations'] loop
    execute format($f$
      drop trigger if exists lock_owner on public.%1$I;
      create trigger lock_owner before update on public.%1$I
        for each row execute function public.lock_owner();
    $f$, t);
  end loop;
end $$;

-- commenti: il nome dell'autore viene dal profilo, non dal client (niente firme false)
create or replace function public.comments_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(
    (select coalesce(nullif(nome, ''), email) from public.members where user_id = new.author_id),
    'Mister');
  return new;
end $$;

drop trigger if exists comments_author on public.comments;
create trigger comments_author before insert on public.comments
  for each row execute function public.comments_author();
