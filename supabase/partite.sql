-- GSD Coach — partite ufficiali (eseguire dopo schema.sql e feedback.sql)

create table if not exists public.matches (
  id         uuid primary key,
  data       jsonb not null,
  owner_id   uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.matches enable row level security;

drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select using (public.is_member());
drop policy if exists matches_ins on public.matches;
create policy matches_ins on public.matches for insert with check (public.is_member() and owner_id = auth.uid());
-- note partita condivise: tutto lo staff può aggiornarle; elimina solo chi le ha create o l'admin
drop policy if exists matches_upd on public.matches;
create policy matches_upd on public.matches for update using (public.is_member());
drop policy if exists matches_del on public.matches;
create policy matches_del on public.matches for delete using (public.is_member() and (owner_id = auth.uid() or public.is_admin()));

-- feedback anche sulle partite
alter table public.comments drop constraint if exists comments_target_type_check;
alter table public.comments add constraint comments_target_type_check check (target_type in ('session','exercise','match'));

do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;
