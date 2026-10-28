-- PressingPro CI — onboarding propriétaire (auto-inscription contrôlée)
--
-- Objectif : permettre à un compte fraîchement inscrit, sans aucun
-- rattachement, de créer SA propre organisation et sa première agence en une
-- seule transaction, sans ouvrir d'écriture générique sur les tables tenant.
--
-- Garanties :
-- 1. seule une session authentifiée peut appeler la RPC (jamais anon) ;
-- 2. un compte déjà rattaché à une organisation active est rejeté : cette RPC
--    sert au premier accès propriétaire, pas à créer des accès employés
--    (ceux-ci restent attribués de façon contrôlée par le propriétaire) ;
-- 3. le rôle créé est `organization_owner` pour l'appelant uniquement ;
-- 4. les slugs sont générés côté serveur et dédupliqués ;
-- 5. le catalogue amorcé (optionnel) reprend les prestations et tarifs
--    proposés par défaut dans l'application ; ils restent modifiables par
--    l'agence et ne constituent pas une grille commerciale imposée.

create or replace function public.create_my_organization(
  p_organization_name text,
  p_shop_name text,
  p_city text default null,
  p_address text default null,
  p_phone_display text default null,
  p_shop_email text default null,
  p_tagline text default '',
  p_pickup_fee_xof bigint default 1000,
  p_delivery_fee_xof bigint default 1000,
  p_seed_catalog boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_organization_name text := btrim(coalesce(p_organization_name, ''));
  v_shop_name text := btrim(coalesce(p_shop_name, ''));
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone_display, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_shop_email, ''))), '');
  v_tagline text := btrim(coalesce(p_tagline, ''));
  v_base_slug text;
  v_slug text;
  v_shop_slug text;
  v_suffix int := 2;
  v_organization_id uuid;
  v_shop_id uuid;
  v_catalog_count int := 0;
begin
  if v_actor is null then
    raise exception 'Session authentifiée requise pour créer une organisation'
      using errcode = '42501';
  end if;

  if length(v_organization_name) not between 2 and 160 then
    raise exception 'Le nom de l’organisation doit contenir entre 2 et 160 caractères'
      using errcode = '22023';
  end if;

  if length(v_shop_name) not between 2 and 160 then
    raise exception 'Le nom de l’agence doit contenir entre 2 et 160 caractères'
      using errcode = '22023';
  end if;

  if length(coalesce(v_city, '')) > 120
     or length(coalesce(v_address, '')) > 300
     or length(coalesce(v_phone, '')) > 40
     or length(v_tagline) > 160 then
    raise exception 'Un champ de l’agence dépasse la longueur autorisée'
      using errcode = '22023';
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'L’adresse e-mail de l’agence est invalide'
      using errcode = '22023';
  end if;

  if coalesce(p_pickup_fee_xof, -1) < 0 or coalesce(p_pickup_fee_xof, 0) > 100000
     or coalesce(p_delivery_fee_xof, -1) < 0 or coalesce(p_delivery_fee_xof, 0) > 100000 then
    raise exception 'Les frais de ramassage et de livraison doivent être compris entre 0 et 100 000 FCFA'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where user_id = v_actor) then
    raise exception 'Profil utilisateur introuvable : reconnectez-vous puis réessayez'
      using errcode = 'P0002';
  end if;

  -- Sérialise les doubles soumissions du même compte (double clic, reprise
  -- réseau) ; le contrôle de rattachement ci-dessous reste l'autorité.
  perform pg_advisory_xact_lock(hashtext('pressingpro:onboard:' || v_actor::text));

  if exists (
    select 1
    from public.memberships
    where user_id = v_actor
      and status = 'active'
  ) then
    raise exception 'Ce compte est déjà rattaché à une organisation active'
      using errcode = '23505';
  end if;

  -- Slug d'organisation : minuscules ASCII, dédupliqué par suffixe numérique.
  v_base_slug := trim(both '-' from regexp_replace(
    translate(lower(v_organization_name), 'àáâäãåèéêëìíîïòóôöõùúûüÿñç', 'aaaaaaeeeeiiiiooooouuuuync'),
    '[^a-z0-9]+', '-', 'g'
  ));
  v_base_slug := trim(both '-' from left(v_base_slug, 48));
  if v_base_slug = '' then
    v_base_slug := 'pressing';
  end if;
  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_base_slug || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  v_shop_slug := trim(both '-' from regexp_replace(
    translate(lower(v_shop_name), 'àáâäãåèéêëìíîïòóôöõùúûüÿñç', 'aaaaaaeeeeiiiiooooouuuuync'),
    '[^a-z0-9]+', '-', 'g'
  ));
  v_shop_slug := trim(both '-' from left(v_shop_slug, 48));
  if v_shop_slug = '' then
    v_shop_slug := 'agence';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (v_organization_name, v_slug, v_actor)
  returning id into v_organization_id;

  insert into public.shops (
    organization_id, name, slug, address, city, phone_display, email
  ) values (
    v_organization_id, v_shop_name, v_shop_slug, v_address, v_city, v_phone, v_email
  )
  returning id into v_shop_id;

  insert into public.memberships (organization_id, shop_id, user_id, role, status)
  values (v_organization_id, null, v_actor, 'organization_owner', 'active');

  insert into public.shop_settings (
    shop_id, organization_id, tagline, pickup_fee_xof, delivery_fee_xof
  ) values (
    v_shop_id, v_organization_id, v_tagline,
    coalesce(p_pickup_fee_xof, 1000), coalesce(p_delivery_fee_xof, 1000)
  );

  insert into public.ticket_counters (shop_id, organization_id, next_number)
  values (v_shop_id, v_organization_id, 1);

  if coalesce(p_seed_catalog, true) then
    insert into public.service_catalog_items (
      organization_id, shop_id, legacy_key, name, audience_category,
      service_category, pricing_type, unit_price_xof, unit_label, sort_order
    )
    select
      v_organization_id,
      v_shop_id,
      seed.legacy_key,
      seed.name,
      seed.audience_category,
      seed.service_category,
      seed.pricing_type,
      seed.unit_price_xof,
      seed.unit_label,
      seed.sort_order
    from (values
      ('c1', 'Chemise', 'men', 'pressing', 'unit', 1500, 'pièce', 10),
      ('c2', 'Pantalon', 'men', 'pressing', 'unit', 1500, 'pièce', 20),
      ('c3', 'Robe', 'women', 'pressing', 'unit', 2500, 'pièce', 30),
      ('c4', 'Costume', 'men', 'pressing', 'unit', 5000, 'pièce', 40),
      ('c5', 'Boubou bazin', 'men', 'pressing', 'unit', 4500, 'pièce', 50),
      ('c6', 'Veste & Manteau', 'men', 'pressing', 'unit', 4000, 'pièce', 60),
      ('c7', 'Foulard & Soie', 'women', 'pressing', 'unit', 800, 'pièce', 70),
      ('c8', 'Jupe', 'women', 'pressing', 'unit', 2000, 'pièce', 80),
      ('c9', 'Pull & Tricot', 'all', 'pressing', 'unit', 2500, 'pièce', 90),
      ('c10', 'Retouche / Ourlet', 'all', 'pressing', 'unit', 1500, 'prestation', 100),
      ('c11', 'Gilet', 'men', 'pressing', 'unit', 2000, 'pièce', 110),
      ('c12', 'Tee-shirt & Polo', 'all', 'pressing', 'unit', 1000, 'pièce', 120),
      ('c13', 'Jean', 'all', 'pressing', 'unit', 1500, 'pièce', 130),
      ('c14', 'Sweat à capuche', 'all', 'pressing', 'unit', 2000, 'pièce', 140),
      ('c15', 'Short & Culotte', 'all', 'pressing', 'unit', 1000, 'pièce', 150),
      ('c16', 'Tailleur femme', 'women', 'pressing', 'unit', 6000, 'ensemble', 160),
      ('c17', 'Combinaison & Salopette', 'all', 'pressing', 'unit', 3000, 'pièce', 170),
      ('c18', 'Marcel & Débardeur', 'all', 'pressing', 'unit', 800, 'pièce', 180),
      ('c19', 'Veste en cuir', 'men', 'pressing', 'unit', 8000, 'pièce', 190),
      ('c20', 'Doudoune & Veste matelassée', 'all', 'pressing', 'unit', 5000, 'pièce', 200),
      ('c21', 'Baskets & Chaussures', 'all', 'pressing', 'unit', 3000, 'paire', 210),
      ('b1', 'Draps & Housses', 'home', 'blanchisserie', 'unit', 2000, 'pièce', 310),
      ('b2', 'Serviettes de bain', 'home', 'blanchisserie', 'unit', 1200, 'pièce', 320),
      ('b3', 'Taies d’oreiller', 'home', 'blanchisserie', 'unit', 800, 'pièce', 330),
      ('b4', 'Nappes & Serviettes table', 'home', 'blanchisserie', 'unit', 2500, 'pièce', 340),
      ('b5', 'Uniformes pro / Médical', 'pro', 'blanchisserie', 'unit', 2000, 'pièce', 350),
      ('b6', 'Linge au kilo (au poids)', 'all', 'blanchisserie', 'kilo', 1000, 'kg', 360),
      ('b7', 'Couette & Édredon', 'home', 'blanchisserie', 'unit', 5000, 'pièce', 370),
      ('b8', 'Rideaux & Voilages', 'home', 'blanchisserie', 'unit', 3000, 'panneau', 380),
      ('b9', 'Chaussettes & petit linge', 'all', 'blanchisserie', 'unit', 500, 'pièce', 390),
      ('b10', 'Pyjama (ensemble)', 'all', 'blanchisserie', 'unit', 2000, 'ensemble', 400),
      ('b11', 'Peignoir & Robe de chambre', 'home', 'blanchisserie', 'unit', 2500, 'pièce', 410)
    ) as seed(legacy_key, name, audience_category, service_category, pricing_type, unit_price_xof, unit_label, sort_order);
    get diagnostics v_catalog_count = row_count;
  end if;

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    v_organization_id,
    v_shop_id,
    v_actor,
    'staff',
    'organization.onboarded',
    'organization',
    v_organization_id,
    jsonb_build_object(
      'organization_slug', v_slug,
      'shop_slug', v_shop_slug,
      'catalog_seeded_items', v_catalog_count
    )
  );

  return jsonb_build_object(
    'organization_id', v_organization_id,
    'organization_name', v_organization_name,
    'organization_slug', v_slug,
    'shop_id', v_shop_id,
    'shop_name', v_shop_name,
    'shop_slug', v_shop_slug,
    'role', 'organization_owner',
    'catalog_seeded_items', v_catalog_count
  );
end;
$$;

revoke all on function public.create_my_organization(
  text, text, text, text, text, text, text, bigint, bigint, boolean
) from public, anon;
grant execute on function public.create_my_organization(
  text, text, text, text, text, text, text, bigint, bigint, boolean
) to authenticated;
