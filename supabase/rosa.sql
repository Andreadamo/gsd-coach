-- GSD Coach — rosa e valutazioni giocatori (eseguire dopo schema.sql)
-- Dati di minori: inserire solo ciò che serve all'attività sportiva; accesso limitato allo staff approvato.

do $$
declare t text;
begin
  foreach t in array array['players','evaluations'] loop
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
      drop policy if exists %1$s_del on public.%1$I;
      create policy %1$s_del on public.%1$I for delete using (public.is_member() and (owner_id = auth.uid() or public.is_admin()));
    $f$, t);
  end loop;
end $$;

-- rosa condivisa: ogni mister aggiorna le schede giocatore; i voti li modifica solo chi li ha dati (o l'admin)
drop policy if exists players_upd on public.players;
create policy players_upd on public.players for update using (public.is_member());
drop policy if exists evaluations_upd on public.evaluations;
create policy evaluations_upd on public.evaluations for update using (public.is_member() and (owner_id = auth.uid() or public.is_admin()));

do $$ begin
  alter publication supabase_realtime add table public.players, public.evaluations;
exception when duplicate_object then null;
end $$;
