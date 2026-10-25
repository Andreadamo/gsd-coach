-- GSD Coach — feedback tra mister (eseguire dopo schema.sql)

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('session','exercise','match')),
  target_id   uuid not null,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '',
  tipo        text not null default 'commento' check (tipo in ('commento','spunto','modifica')),
  body        text not null check (char_length(body) between 1 and 2000),
  risolto     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists comments_target_idx on public.comments (target_type, target_id, created_at);
create index if not exists comments_created_idx on public.comments (created_at desc);

alter table public.comments enable row level security;

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (public.is_member());

drop policy if exists comments_ins on public.comments;
create policy comments_ins on public.comments for insert
  with check (public.is_member() and author_id = auth.uid());

-- chiunque dello staff può segnare come risolto; il testo lo modifica solo l'autore (vedi trigger)
drop policy if exists comments_upd on public.comments;
create policy comments_upd on public.comments for update using (public.is_member());

drop policy if exists comments_del on public.comments;
create policy comments_del on public.comments for delete
  using (author_id = auth.uid() or public.is_admin());

create or replace function public.comments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.author_id <> old.author_id or new.target_id <> old.target_id or new.target_type <> old.target_type
     or new.created_at <> old.created_at or new.author_name <> old.author_name then
    raise exception 'Campo non modificabile';
  end if;
  if (new.body <> old.body or new.tipo <> old.tipo) and old.author_id <> auth.uid() then
    raise exception 'Solo l''autore può modificare il testo';
  end if;
  return new;
end $$;

drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before update on public.comments
  for each row execute function public.comments_guard();

do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null;
end $$;
