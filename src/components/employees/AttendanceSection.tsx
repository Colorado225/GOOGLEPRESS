import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal, ModalShell } from '../common/ModalShell';
import { EmptyState, ResetFiltersButton } from '../common/ModuleCommon';
import { Avatar, AvatarFallback, Badge } from '../common/DataTable';
import { AttendanceRecord, AttendanceStatus, EMPLOYEE_POSITIONS, Employee } from '../../types';
import { addDaysToISO, capitalize, formatISODateLongFr, todayISO } from '../../lib/dates';
import { getInitials, normalizeText } from '../../lib/utils';
import {
  ATTENDANCE_STATUS_BADGE,
  ATTENDANCE_STATUS_LABELS,
  getAttendanceRecord,
  summarizeAttendance,
} from './employeeLabels';
import { ChevronLeft, ChevronRight, Pencil, RotateCcw } from 'lucide-react';

type RecordedStatus = AttendanceRecord['status'];
const RECORDED_STATUSES: RecordedStatus[] = ['present', 'late', 'absent', 'leave'];

interface AttendanceSectionProps {
  employeeFilterId: string; // 'all' ou id employé
  onEmployeeFilterChange: (id: string) => void;
  onOpenEmployee: (employee: Employee) => void;
}

export const AttendanceSection: React.FC<AttendanceSectionProps> = ({
  employeeFilterId,
  onEmployeeFilterChange,
  onOpenEmployee,
}) => {
  const { employees, attendanceRecords, upsertAttendance, removeAttendance } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');

  // Modale de saisie / correction
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editStatus, setEditStatus] = useState<RecordedStatus>('present');
  const [editArrival, setEditArrival] = useState('');
  const [editReason, setEditReason] = useState('');
  const [confirmClear, setConfirmClear] = useState<Employee | null>(null);

  // Les employés inactifs ne sont pas pointés.
  const pointableEmployees = useMemo(
    () => employees.filter((e) => e.status !== 'inactive'),
    [employees]
  );

  const summary = useMemo(
    () => summarizeAttendance(attendanceRecords, pointableEmployees.map((e) => e.id), selectedDate),
    [attendanceRecords, pointableEmployees, selectedDate]
  );

  const visibleEmployees = useMemo(() => {
    return pointableEmployees.filter((e) => {
      if (employeeFilterId !== 'all' && e.id !== employeeFilterId) return false;
      if (positionFilter !== 'all' && e.position !== positionFilter) return false;
      if (statusFilter !== 'all') {
        const current = getAttendanceRecord(attendanceRecords, e.id, selectedDate)?.status ?? 'unrecorded';
        if (current !== statusFilter) return false;
      }
      return true;
    });
  }, [pointableEmployees, employeeFilterId, positionFilter, statusFilter, attendanceRecords, selectedDate]);

  const hasActiveFilters = employeeFilterId !== 'all' || positionFilter !== 'all' || statusFilter !== 'all';
  const resetFilters = () => {
    onEmployeeFilterChange('all');
    setPositionFilter('all');
    setStatusFilter('all');
  };

  const openEdit = (employee: Employee) => {
    const existing = getAttendanceRecord(attendanceRecords, employee.id, selectedDate);
    setEditing(employee);
    setEditStatus(existing?.status ?? 'present');
    setEditArrival(existing?.arrivalTime ?? '');
    setEditReason(existing?.reason ?? '');
  };

  const editingExisting = editing
    ? getAttendanceRecord(attendanceRecords, editing.id, selectedDate)
    : undefined;
  const isCorrection =
    editingExisting !== undefined &&
    (editingExisting.status !== editStatus ||
      (editingExisting.arrivalTime ?? '') !== editArrival.trim() ||
      (editingExisting.reason ?? '') !== editReason.trim());

  const saveEdit = () => {
    if (!editing) return;
    upsertAttendance(editing.id, selectedDate, editStatus, {
      arrivalTime: editStatus === 'present' || editStatus === 'late' ? editArrival.trim() || undefined : undefined,
      reason: editStatus === 'absent' || editStatus === 'leave' ? editReason.trim() || undefined : undefined,
    });
    setEditing(null);
  };

  const inputClass =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  return (
    <div className="space-y-3">
      {/* Sélecteur de date */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDaysToISO(d, -1))}
            aria-label="Jour précédent"
            className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <label htmlFor="attendance-date" className="sr-only">Date des présences</label>
          <input
            id="attendance-date"
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className={`${inputClass} font-semibold tabular-nums`}
          />
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDaysToISO(d, 1))}
            aria-label="Jour suivant"
            className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {selectedDate !== todayISO() && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayISO())}
              className="text-[12px] font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              Aujourd’hui
            </button>
          )}
        </div>
        <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 first-letter:uppercase">
          {capitalize(formatISODateLongFr(selectedDate))}
        </p>
        <div className="flex flex-wrap gap-1.5 ml-auto" aria-label="Résumé du jour">
          {([
            ['present', summary.present],
            ['late', summary.late],
            ['absent', summary.absent],
            ['leave', summary.leave],
            ['unrecorded', summary.unrecorded],
          ] as const).map(([status, value]) => (
            <Badge key={status} size="sm" className={`py-1 ${ATTENDANCE_STATUS_BADGE[status]}`}>
              {ATTENDANCE_STATUS_LABELS[status]} : {value}
            </Badge>
          ))}
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center gap-2">
          <label htmlFor="att-employee" className="sr-only">Filtrer par employé</label>
          <select
            id="att-employee"
            value={employeeFilterId}
            onChange={(e) => onEmployeeFilterChange(e.target.value)}
            className={inputClass}
          >
            <option value="all">Tous les employés</option>
            {pointableEmployees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </select>

          <label htmlFor="att-position" className="sr-only">Filtrer par poste</label>
          <select
            id="att-position"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className={inputClass}
          >
            <option value="all">Tous les postes</option>
            {EMPLOYEE_POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <label htmlFor="att-status" className="sr-only">Filtrer par statut de présence</label>
          <select
            id="att-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | AttendanceStatus)}
            className={inputClass}
          >
            <option value="all">Présence : toutes</option>
            {(Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]).map((s) => (
              <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>
            ))}
          </select>

          {hasActiveFilters && <ResetFiltersButton onClick={resetFilters} />}
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium ml-auto tabular-nums">
            {visibleEmployees.length} personne(s) affichée(s)
          </span>
        </div>

        {pointableEmployees.length === 0 ? (
          <EmptyState
            title="Aucun employé à pointer"
            description="Ajoutez d'abord un employé actif depuis l'onglet Employés pour saisir ses présences."
          />
        ) : visibleEmployees.length === 0 ? (
          <EmptyState
            title="Aucun résultat pour ces filtres"
            description="Aucun employé ne correspond à la combinaison employé / poste / présence choisie pour cette date."
            action={<ResetFiltersButton onClick={resetFilters} />}
          />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibleEmployees.map((employee) => {
              const record = getAttendanceRecord(attendanceRecords, employee.id, selectedDate);
              const status: AttendanceStatus = record?.status ?? 'unrecorded';
              return (
                <li key={employee.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/60 transition-colors">
                  <button
                    type="button"
                    onClick={() => onOpenEmployee(employee)}
                    className="flex items-center gap-2.5 min-w-0 text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 px-1 py-0.5"
                    aria-label={`Ouvrir la fiche de ${employee.fullName}`}
                  >
                    <Avatar size="sm" aria-hidden="true">
                      <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block font-bold text-[13px] text-zinc-900 dark:text-zinc-100 truncate">{employee.fullName}</span>
                      <span className="block text-[11.5px] text-zinc-500 dark:text-zinc-400">{employee.position}</span>
                    </span>
                  </button>

                  <Badge size="sm" className={ATTENDANCE_STATUS_BADGE[status]}>
                    {ATTENDANCE_STATUS_LABELS[status]}
                    {record?.arrivalTime ? ` · ${record.arrivalTime}` : ''}
                  </Badge>
                  {record?.reason && (
                    <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400 italic truncate max-w-[220px]" title={record.reason}>
                      {record.reason}
                    </span>
                  )}

                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(employee)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {record ? 'Corriger' : 'Saisir'}
                    </button>
                    {record && (
                      <button
                        type="button"
                        onClick={() => setConfirmClear(employee)}
                        aria-label={`Effacer la saisie du jour pour ${employee.fullName}`}
                        title="Effacer la saisie (retour à « Non renseigné »)"
                        className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 dark:text-zinc-500">
          Les employés désactivés ne sont pas pointés. « Non renseigné » signifie qu’aucune saisie n’a été faite — ce n’est pas une absence.
        </p>
      </div>

      {/* Saisie / correction */}
      {editing && (
        <ModalShell
          title={editingExisting ? 'Corriger la présence' : 'Saisir une présence'}
          subtitle={`${editing.fullName} — ${capitalize(formatISODateLongFr(selectedDate))}`}
          onClose={() => setEditing(null)}
        >
          <div className="p-5 space-y-3.5 text-[13px]">
            {editingExisting && (
              <p className="text-[12px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                Saisie existante : <strong>{ATTENDANCE_STATUS_LABELS[editingExisting.status]}</strong>
                {editingExisting.arrivalTime ? ` à ${editingExisting.arrivalTime}` : ''}
                {editingExisting.reason ? ` — ${editingExisting.reason}` : ''}. Enregistrer remplacera
                cette saisie (une seule entrée par employé et par jour).
              </p>
            )}

            <div>
              <label htmlFor="att-edit-status" className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                Statut *
              </label>
              <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Choisir le statut de présence">
                {RECORDED_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditStatus(s)}
                    aria-pressed={editStatus === s}
                    className={`py-2 rounded-lg border text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
                      editStatus === s
                        ? 'bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 border-[#09090b] dark:border-zinc-100'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    {ATTENDANCE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {(editStatus === 'present' || editStatus === 'late') && (
              <div>
                <label htmlFor="att-edit-arrival" className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Heure d’arrivée (optionnelle)
                </label>
                <input
                  id="att-edit-arrival"
                  type="time"
                  value={editArrival}
                  onChange={(e) => setEditArrival(e.target.value)}
                  className={`${inputClass} w-full tabular-nums`}
                />
              </div>
            )}

            {(editStatus === 'absent' || editStatus === 'leave') && (
              <div>
                <label htmlFor="att-edit-reason" className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                  Motif (optionnel)
                </label>
                <input
                  id="att-edit-reason"
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder={editStatus === 'leave' ? 'Ex : Congé annuel, congé maladie…' : 'Ex : A prévenu par téléphone…'}
                  className={`${inputClass} w-full`}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="flex-1 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold rounded-lg py-2.5 shadow transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                {isCorrection ? 'Confirmer la correction' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {confirmClear && (
        <ConfirmModal
          title="Effacer cette saisie ?"
          description={
            <>
              La présence de <strong>{confirmClear.fullName}</strong> pour le{' '}
              {formatISODateLongFr(selectedDate)} sera supprimée et redeviendra « Non renseigné ».
            </>
          }
          confirmLabel="Oui, effacer"
          danger
          onCancel={() => setConfirmClear(null)}
          onConfirm={() => {
            removeAttendance(confirmClear.id, selectedDate);
            setConfirmClear(null);
          }}
        />
      )}
    </div>
  );
};
