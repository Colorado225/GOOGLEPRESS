-- Paramètres de l'application enregistrés côté base.
--
-- Jusqu'ici, l'écran Paramètres écrivait uniquement dans le navigateur
-- (`pressingpro_shop_settings`). Deux appareils du même pressing pouvaient donc
-- afficher deux configurations différentes, et vider le cache du navigateur
-- effaçait la grille tarifaire, les prestations, le catalogue et les réglages
-- de livraison.
--
-- On ajoute un instantané complet (`settings`, JSONB) à la table
-- `shop_settings` existante. Les colonnes historiques restent écrites en
-- parallèle : le calcul serveur des commandes et les autres RPC continuent de
-- lire `pickup_fee_xof`, `delivery_fee_xof`, etc.

alter table public.shop_settings
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists settings_updated_at timestamptz not null default now();

comment on column public.shop_settings.settings is
  'Instantané des paramètres de l''application (identité, prestations, catalogue, livraison, rangement).';
comment on column public.shop_settings.settings_updated_at is
  'Horodatage serveur du dernier enregistrement des paramètres.';

-- Les colonnes ajoutées doivent être autorisées à la mise à jour : le droit
-- est accordé colonne par colonne depuis la phase 0.
grant update (settings, settings_updated_at) on public.shop_settings to authenticated;

-- Horodatage serveur fiable : il ne dépend pas de l'horloge du téléphone.
create or replace function private.touch_shop_settings_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.settings_updated_at := now();
  return new;
end;
$$;

drop trigger if exists shop_settings_touch on public.shop_settings;
create trigger shop_settings_touch
before update on public.shop_settings
for each row execute function private.touch_shop_settings_timestamp();

-- Les lignes créées avant cette migration gardent un instantané vide : le
-- navigateur les complète avec les colonnes historiques puis les réenregistre.
