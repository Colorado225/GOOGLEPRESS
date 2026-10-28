-- PressingPro CI — opération ponctuelle Pressing_Pro du 28 octobre 2026
-- HISTORIQUE D'EXÉCUTION — NE PAS REJOUER.
--
-- Ce SQL a été appliqué une seule fois à Pressing_Pro
-- (phjstsydxvggtduohfrl) sous le nom distant
-- `phase0_remove_legacy_pressingpro`, version 20261028094204.
--
-- Il est volontairement placé hors de `supabase/migrations/` : il supprime les
-- routines publiques d'un héritage précis et ne doit jamais faire partie d'une
-- migration réutilisable sur un autre environnement.

-- Phase 0 — suppression contrôlée de l'héritage Pressing_Pro
-- Périmètre : uniquement le déclencheur d'événement et les routines du schéma public.
-- Les schémas et déclencheurs d'infrastructure Supabase ne sont pas touchés.

drop event trigger if exists ensure_rls;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1
        from pg_catalog.pg_depend d
        where d.objid = p.oid
          and d.deptype = 'e'
      )
    order by p.proname
  loop
    execute format('drop routine if exists %s cascade', r.signature);
  end loop;
end;
$$;

-- Les futurs objets créés par postgres dans public ne doivent plus recevoir
-- automatiquement des droits API. Les migrations du nouveau socle accorderont
-- explicitement les seuls privilèges nécessaires.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
