-- PressingPro CI — alignement hébergé de la RPC d'onboarding (traçabilité)
--
-- Contexte (2026-10-28, activation Pressing_Pro) : la première application
-- distante de `20261028160000_owner_onboarding.sql` (migration hébergée
-- `owner_onboarding`, version 20261028144558) a installé une retranscription
-- inexacte de `create_my_organization` (signature à 7 paramètres, appel à une
-- fonction `private.slugify` inexistante, table `shop_counters` inexistante).
-- L'erreur a été détectée immédiatement par la recette transactionnelle
-- annulée exécutée juste après l'application : aucune donnée, aucun compte
-- et aucun accès n'ont été créés (comptes vérifiés à zéro après rollback).
--
-- La migration hébergée `owner_onboarding_fix_alignment`
-- (version 20261028144951) a ensuite supprimé cette surcharge erronée et
-- installé la définition exacte du fichier `20261028160000`. L'identité
-- entre la base hébergée et le dépôt a été prouvée par comparaison des
-- empreintes `md5(prosrc)` et des signatures des 7 fonctions concernées
-- (5 publiques, 2 privées), puis par une recette complète annulée :
-- onboarding fictif → cliente → commande tarifée serveur → paiement Wave
-- manuel → remboursement → totaux de caisse → refus des écritures directes.
--
-- Le présent fichier rend l'historique du dépôt explicite et 1:1 avec
-- l'hébergé. Son seul effet SQL est défensif et idempotent : supprimer la
-- surcharge erronée si elle existait dans un autre environnement. La
-- définition de référence reste celle de `20261028160000_owner_onboarding.sql`.

drop function if exists public.create_my_organization(
  text, text, text, text, bigint, bigint, boolean
);
