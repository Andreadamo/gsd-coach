-- GSD Coach — hardening 2 (eseguire dopo hardening.sql). Idempotente.
-- Risolve gli avvisi del Security/Performance Advisor di Supabase.

-- 1) Funzioni trigger: non devono essere chiamabili via /rest/v1/rpc.
--    I trigger scattano comunque (il permesso EXECUTE non serve per farli girare).
do $$
declare f text;
begin
  foreach f in array array['handle_new_user','comments_guard','lock_owner','comments_author'] loop
    if exists (select 1 from pg_proc where proname = f and pronamespace = 'public'::regnamespace) then
      execute format('revoke execute on function public.%I() from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- 2) is_member / is_admin servono alle policy RLS degli utenti loggati: si toglie solo l'accesso anonimo.
revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_admin()  from public, anon;
grant  execute on function public.is_member() to authenticated;
grant  execute on function public.is_admin()  to authenticated;

-- 3) Policy RLS: auth.uid() calcolato una volta per query invece che per ogni riga (stessa logica).
do $$
declare p record; q text; c text;
begin
  for p in select * from pg_policies where schemaname = 'public' loop
    q := p.qual;
    c := p.with_check;
    if q is not null and q ~ 'auth\.uid\(\)' and q !~ 'SELECT auth\.uid\(\)' then
      q := replace(q, 'auth.uid()', '(select auth.uid())');
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, q);
    end if;
    if c is not null and c ~ 'auth\.uid\(\)' and c !~ 'SELECT auth\.uid\(\)' then
      c := replace(c, 'auth.uid()', '(select auth.uid())');
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, c);
    end if;
  end loop;
end $$;

-- 4) Indici sulle chiavi esterne (owner_id / author_id).
do $$
declare t text;
begin
  foreach t in array array['exercises','sessions','cycles','matches','players','evaluations'] loop
    execute format('create index if not exists %1$s_owner_idx on public.%1$I (owner_id)', t);
  end loop;
end $$;
create index if not exists comments_author_idx on public.comments (author_id);
