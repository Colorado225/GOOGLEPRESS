-- PressingPro CI — ordonnanceur quotidien des opérations plateforme.
-- Aucun doublon : la tâche nommée est créée une seule fois. Sur un environnement
-- sans pg_cron disponible, cette migration ne fait rien et la console conserve
-- honnêtement l'état « manuel ».

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension pg_cron with schema pg_catalog';
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (
      select 1 from cron.job where jobname = 'pressingpro-platform-automations'
    ) then
      perform cron.schedule(
        'pressingpro-platform-automations',
        '17 5 * * *',
        'select public.run_platform_automations();'
      );
    end if;
  end if;
end;
$$;
