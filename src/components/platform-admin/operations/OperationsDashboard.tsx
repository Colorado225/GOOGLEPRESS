import React from 'react';
import { AlertTriangle, BellRing, Building2, CalendarClock, CheckCheck, CreditCard, Headphones, LockKeyhole, ReceiptText, TrendingUp, UsersRound } from 'lucide-react';
import type { PlatformAdminOrganization } from '../../../lib/platformAdmin';
import { formatPlatformDate, formatXof, getPlatformCommercialMetrics } from '../../../lib/platformOperations';
import { OperationBadge, OperationEmpty, OperationMetric, OperationPanel, operationSecondaryClass, type PlatformOperationPanelProps } from './ui';

export const OperationsDashboard: React.FC<PlatformOperationPanelProps & {
  organizations: PlatformAdminOrganization[];
  onOpen: (view: 'finance' | 'subscriptions' | 'support' | 'audit') => void;
}> = ({ snapshot, organizations, run, busy, onOpen }) => {
  const metrics = getPlatformCommercialMetrics(organizations, snapshot);
  const pendingRequests = organizations.flatMap((organization) => organization.shops.filter((shop) => shop.subscription.requested_plan).map((shop) => ({ organization, shop })));
  const renewals = organizations.flatMap((organization) => organization.shops.filter((shop) => shop.subscription.renews_on).map((shop) => ({ organization, shop }))).sort((a, b) => (a.shop.subscription.renews_on ?? '').localeCompare(b.shop.subscription.renews_on ?? '')).slice(0, 8);
  const unread = snapshot.notifications.filter((entry) => !entry.read_at);

  return (
    <div className="space-y-5">
      <section aria-label="Indicateurs commerciaux" className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <OperationMetric label="Revenu mensuel récurrent" value={formatXof(metrics.mrr)} detail="Abonnements payants actifs" icon={TrendingUp} tone="success" />
        <OperationMetric label="Encaissé ce mois" value={formatXof(metrics.collectedThisMonth)} detail="Paiements nets enregistrés" icon={CreditCard} tone="success" />
        <OperationMetric label="Solde à recouvrer" value={formatXof(metrics.outstanding)} detail={`${metrics.overdue} facture(s) en retard`} icon={ReceiptText} tone={metrics.overdue ? 'danger' : 'default'} />
        <OperationMetric label="Comptes actifs" value={metrics.active} detail={`${metrics.trials} essai(s) · ${metrics.registrations30} inscription(s)/30 j`} icon={Building2} />
        <OperationMetric label="Renouvellements" value={metrics.renewals30} detail="Dans les 30 prochains jours" icon={CalendarClock} tone="warning" />
        <OperationMetric label="Support & accès" value={metrics.openTickets} detail={`${metrics.suspended} compte(s) verrouillé(s)`} icon={Headphones} tone={metrics.openTickets ? 'warning' : 'default'} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <OperationPanel
          title="Alertes et tâches d’administration"
          description="Inscriptions, paiements, renouvellements, tickets et sécurité. Les alertes ne contiennent aucune commande ni donnée client d’un pressing."
          action={unread.length > 0 ? <button type="button" className={operationSecondaryClass} disabled={busy} onClick={() => run('notifications.read', { all: true }, 'Toutes les notifications ont été marquées comme lues.')}><CheckCheck className="h-4 w-4" /> Tout marquer lu</button> : undefined}
        >
          {unread.length === 0 ? <OperationEmpty>Aucune alerte non lue. Les nouveaux événements apparaîtront ici.</OperationEmpty> : (
            <ul className="space-y-2">
              {unread.slice(0, 12).map((notification) => (
                <li key={notification.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${notification.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : notification.severity === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'}`}>
                    {notification.severity === 'critical' ? <AlertTriangle className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h4 className="text-[12.5px] font-black">{notification.title}</h4><OperationBadge tone={notification.severity === 'critical' ? 'danger' : notification.severity === 'warning' ? 'warning' : 'info'}>{notification.kind}</OperationBadge></div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">{notification.body}</p>
                    <time className="mt-1 block text-[10px] text-zinc-400" dateTime={notification.created_at}>{formatPlatformDate(notification.created_at)}</time>
                  </div>
                  <button type="button" className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400" disabled={busy} onClick={() => run('notifications.read', { ids: [notification.id] }, 'Notification marquée comme lue.')}>Marquer lu</button>
                </li>
              ))}
            </ul>
          )}
        </OperationPanel>

        <OperationPanel title="Répartition des formules" description="Nombre d’agences par formule appliquée.">
          <div className="space-y-3">
            {metrics.planDistribution.map(({ plan, count }) => {
              const total = Math.max(1, metrics.planDistribution.reduce((sum, entry) => sum + entry.count, 0));
              return <div key={plan}><div className="flex items-center justify-between text-[12px] font-bold"><span className="uppercase">{plan}</span><span>{count}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={`h-full rounded-full ${plan === 'business' ? 'bg-violet-600' : plan === 'pro' ? 'bg-blue-600' : 'bg-zinc-400'}`} style={{ width: `${Math.round(count / total * 100)}%` }} /></div></div>;
            })}
          </div>
          <button type="button" className={`${operationSecondaryClass} mt-5 w-full`} onClick={() => onOpen('subscriptions')}><UsersRound className="h-4 w-4" /> Gérer les offres et échéances</button>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/50"><strong className="block text-[18px] text-zinc-900 dark:text-zinc-100">{metrics.cancellations}</strong>Résiliation(s) programmée(s)</span>
            <span className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/50"><strong className="block text-[18px] text-zinc-900 dark:text-zinc-100">{metrics.suspended}</strong>Accès verrouillé(s)</span>
          </div>
        </OperationPanel>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <OperationPanel title="Demandes de formule à valider" action={<button type="button" className="text-[11px] font-bold text-blue-600 hover:underline" onClick={() => onOpen('subscriptions')}>Voir les abonnements</button>}>
          {pendingRequests.length === 0 ? <OperationEmpty>Aucune demande de formule en attente.</OperationEmpty> : <ul className="space-y-2">{pendingRequests.map(({ organization, shop }) => <li key={shop.id} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><div><p className="text-[12px] font-black">{organization.name}</p><p className="text-[11px] text-zinc-500">{shop.name}</p></div><OperationBadge tone="warning">{shop.subscription.requested_plan}</OperationBadge></li>)}</ul>}
        </OperationPanel>
        <OperationPanel title="Prochaines échéances" action={<button type="button" className="text-[11px] font-bold text-blue-600 hover:underline" onClick={() => onOpen('finance')}>Voir la facturation</button>}>
          {renewals.length === 0 ? <OperationEmpty>Aucune date de renouvellement enregistrée.</OperationEmpty> : <ul className="space-y-2">{renewals.map(({ organization, shop }) => <li key={shop.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"><div><p className="text-[12px] font-black">{shop.name}</p><p className="text-[11px] text-zinc-500">{organization.name} · {shop.subscription.plan.toUpperCase()}</p></div><time className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">{shop.subscription.renews_on}</time></li>)}</ul>}
        </OperationPanel>
      </div>

      <OperationPanel title="Dernières actions auditées" action={<button type="button" className={operationSecondaryClass} onClick={() => onOpen('audit')}><LockKeyhole className="h-4 w-4" /> Ouvrir l’audit complet</button>}>
        {snapshot.audit.length === 0 ? <OperationEmpty>Les modifications effectuées depuis les nouveaux modules seront journalisées ici.</OperationEmpty> : <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{snapshot.audit.slice(0, 6).map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11.5px]"><div><p className="font-bold">{entry.action}</p><p className="text-zinc-500">{entry.organization_name ?? 'Plateforme'} · {entry.resource_type ?? 'ressource'}</p></div><time className="text-zinc-400">{formatPlatformDate(entry.created_at)}</time></li>)}</ul>}
      </OperationPanel>
    </div>
  );
};
