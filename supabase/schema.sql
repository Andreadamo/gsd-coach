-- GSD Coach — schema Supabase
-- Eseguire una volta in Supabase → SQL Editor → New query → Run.

-- ===== Staff (mister) =====
create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  ruolo      text not null default 'mister' check (ruolo in ('admin','mister')),
  approvato  boolean not null default false,
  created_at timestamptz not null default now()
);

-- Il primo utente registrato diventa admin approvato, gli altri restano in attesa.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.members;
  insert into public.members (user_id, email, nome, ruolo, approvato)
  values (new.id, new.email, split_part(new.email,'@',1),
          case when n = 0 then 'admin' else 'mister' end,
          n = 0);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and approvato);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and approvato and ruolo = 'admin');
$$;

alter table public.members enable row level security;
drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (user_id = auth.uid() or public.is_member());
drop policy if exists members_admin on public.members;
create policy members_admin on public.members for update using (public.is_admin());
drop policy if exists members_admin_del on public.members;
create policy members_admin_del on public.members for delete using (public.is_admin());

-- ===== Dati (jsonb, condivisi tra i mister approvati) =====
do $$
declare t text;
begin
  foreach t in array array['exercises','sessions','cycles'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id         uuid primary key,
        data       jsonb not null,
        owner_id   uuid default auth.uid() references auth.users(id) on delete set null,
        updated_at timestamptz not null default now()
      );
      alter table public.%1$I enable row level security;
      drop policy if exists %1$s_read on public.%1$I;
      create policy %1$s_read on public.%1$I for select using (public.is_member());
      drop policy if exists %1$s_ins on public.%1$I;
      create policy %1$s_ins on public.%1$I for insert with check (public.is_member() and owner_id = auth.uid());
      drop policy if exists %1$s_upd on public.%1$I;
      create policy %1$s_upd on public.%1$I for update using (public.is_member() and (owner_id = auth.uid() or public.is_admin()));
      drop policy if exists %1$s_del on public.%1$I;
      create policy %1$s_del on public.%1$I for delete using (public.is_member() and (owner_id = auth.uid() or public.is_admin()));
    $f$, t);
  end loop;
end $$;

-- Libreria esercizi: tutti i mister approvati possono modificare gli esercizi (libreria condivisa)
drop policy if exists exercises_upd on public.exercises;
create policy exercises_upd on public.exercises for update using (public.is_member());

-- Realtime
alter publication supabase_realtime add table public.exercises, public.sessions, public.cycles;
