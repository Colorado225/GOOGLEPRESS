import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SlidePanel } from '../common/ModalShell';
import { Avatar, AvatarFallback, Badge } from '../common/DataTable';
import { Employee } from '../../types';
import { formatISODateFr, isoDaysFromToday } from '../../lib/dates';
import { getInitials } from '../../lib/utils';
import { getEmployeeAssignedOrders, isOrderFinished, ORDER_STATUS_LABELS } from '../../lib/reports';
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_BADGE,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_BADGE,
} from './employeeLabels';
import { Phone, CalendarDays, Pencil, Ban, UserCheck, ClipboardList, Ticket } from 'lucide-react';

interface EmployeeDetailPanelProps {
  employee: Employee;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
  onViewAttendance: (employee: Employee) => void;
}

export const EmployeeDetailPanel: React.FC<EmployeeDetailPanelProps> = ({
  employee,
  onClose,
  onEdit,
  onToggleActive,
  onViewAttendance,
}) => {
  const { attendanceRecords, orders, setPreviewTicket } = useApp();

  const assignedOrders = useMemo(
    () => getEmployeeAssignedOrders(orders, employee),
    [orders, employee]
  );
  const finishedCount = assignedOrders.filter(isOrderFinished).length;

  // Présences des 30 derniers jours (données réellement saisies uniquement)
  const sinceISO = isoDaysFromToday(-29);
  const employeeRecords = useMemo(
    () =>
      attendanceRecords
        .filter((r) => r.employeeId === employee.id && r.date >= sinceISO)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [attendanceRecords, employee.id, sinceISO]
  );
  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, leave: 0 };
    for (const r of employeeRecords) c[r.status] += 1;
    return c;
  }, [employeeRecords]);

  const isInactive = employee.status === 'inactive';

  return (
    <SlidePanel title={employee.fullName} subtitle={`${employee.position} — Fiche employé`} onClose={onClose}>
      {/* Résumé */}
      <section aria-label="Résumé de l'employé">
        <div className="flex items-center gap-3">
          <Avatar aria-hidden="true" className="h-14 w-14 text-[18px] font-black shadow-none ring-0">
            <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100 truncate">{employee.fullName}</p>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">{employee.position}</p>
            <Badge size="sm" className={`mt-1 ${EMPLOYEE_STATUS_BADGE[employee.status]}`}>
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </Badge>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-[13px]">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <Phone className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <dt className="sr-only">Téléphone</dt>
            <dd>{employee.phone ?? 'Non renseigné'}</dd>
          </div>
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <CalendarDays className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <dt className="sr-only">Date d’entrée</dt>
            <dd>Date d’entrée : {employee.hiredAt ? formatISODateFr(employee.hiredAt, true) : 'Non renseigné'}</dd>
          </div>
          {employee.notes && (
            <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-[12.5px] text-zinc-700 dark:text-zinc-300 italic">
              « {employee.notes} »
            </div>
          )}
          <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
            Fiche créée le {employee.createdAt ? formatISODateFr(employee.createdAt.slice(0, 10), true) : 'Non renseigné'}
            {employee.updatedAt && ` · modifiée le ${formatISODateFr(employee.updatedAt.slice(0, 10), true)}`}
          </p>
        </dl>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => onEdit(employee)}
            className="inline-flex items-center gap-1.5 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Pencil className="w-3.5 h-3.5" /> Modifier le profil
          </button>
          <button
            type="button"
            onClick={() => onViewAttendance(employee)}
            className="inline-flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <ClipboardList className="w-3.5 h-3.5" /> Voir ses présences
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(employee)}
            className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors border focus:outline-none focus:ring-2 ${
              isInactive
                ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 focus:ring-emerald-600'
                : 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 focus:ring-red-600'
            }`}
          >
            {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
            {isInactive ? 'Réactiver' : 'Désactiver'}
          </button>
        </div>
      </section>

      {/* Présences */}
      <section aria-label="Présences des 30 derniers jours" className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <h4 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 mb-2">Présences — 30 derniers jours</h4>
        {employeeRecords.length === 0 ? (
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
            Aucune présence saisie sur cette période. Les jours sans saisie sont « Non renseigné »,
            ils ne comptent ni comme présence ni comme absence.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center mb-3">
              {([
                ['present', counts.present],
                ['late', counts.late],
                ['absent', counts.absent],
                ['leave', counts.leave],
              ] as const).map(([status, value]) => (
                <div key={status} className="border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 px-1">
                  <p className="font-black text-[16px] tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
                  <p className="text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400">{ATTENDANCE_STATUS_LABELS[status]}</p>
                </div>
              ))}
            </div>
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {employeeRecords.slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-[12.5px] border border-zinc-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 bg-zinc-50/50 dark:bg-zinc-800/50">
                  <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{formatISODateFr(r.date)}</span>
                  {r.arrivalTime && <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">{r.arrivalTime}</span>}
                  {r.reason && <span className="text-zinc-500 dark:text-zinc-400 truncate flex-1">{r.reason}</span>}
                  <Badge size="sm" className={`shrink-0 text-[10.5px] ${ATTENDANCE_STATUS_BADGE[r.status]}`}>
                    {ATTENDANCE_STATUS_LABELS[r.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Activité atelier (champ « assignee » des commandes) */}
      <section aria-label="Activité atelier" className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <h4 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 mb-1">Activité atelier connue</h4>
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mb-2">
          Commandes où cette personne est indiquée comme responsable à l’atelier
          (champ « assigné à » des commandes — rapprochement par prénom).
        </p>
        {assignedOrders.length === 0 ? (
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
            Aucune commande connue pour cette personne dans les données actuelles.
          </p>
        ) : (
          <>
            <p className="text-[12.5px] text-zinc-700 dark:text-zinc-300 mb-2">
              <strong className="tabular-nums">{assignedOrders.length}</strong> commande(s) affectée(s) ·{' '}
              <strong className="tabular-nums">{finishedCount}</strong> terminée(s) (prête ou livrée)
            </p>
            <ul className="space-y-1.5">
              {assignedOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewTicket(o)}
                    className="w-full flex items-center justify-between gap-2 text-[12.5px] border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg px-2.5 py-2 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Ticket className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{o.ticketNumber}</span>
                      <span className="text-zinc-500 dark:text-zinc-400 truncate">{o.customerName}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">{ORDER_STATUS_LABELS[o.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </SlidePanel>
  );
};
