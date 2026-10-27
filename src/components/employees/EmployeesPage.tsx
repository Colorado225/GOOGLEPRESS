import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ModalShell';
import { PageHeader, LocalDataNotice, EmptyState, ResetFiltersButton, KpiCard } from '../common/ModuleCommon';
import { Tabs } from '../common/Tabs';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Avatar, AvatarFallback } from '../common/DataTable';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeDetailPanel } from './EmployeeDetailPanel';
import { AttendanceSection } from './AttendanceSection';
import { EMPLOYEE_POSITIONS, Employee, EmployeeStatus } from '../../types';
import { todayISO } from '../../lib/dates';
import { getInitials, normalizeText } from '../../lib/utils';
import { getEmployeeAssignedOrders, isOrderFinished } from '../../lib/reports';
import {
  EMPLOYEE_STATUS_BADGE,
  EMPLOYEE_STATUS_LABELS,
  ATTENDANCE_STATUS_BADGE,
  ATTENDANCE_STATUS_LABELS,
  getAttendanceStatus,
  summarizeAttendance,
} from './employeeLabels';
import { Search, Plus, Eye, Pencil, Ban, UserCheck, Phone, Users, ClipboardList } from 'lucide-react';

type TabId = 'list' | 'attendance';
type SortKey = 'name-asc' | 'name-desc' | 'activity' | 'hired';

export const EmployeesPage: React.FC = () => {
  const {
    employees, attendanceRecords, orders, setActiveScreen, setEmployeeStatus,
  } = useApp();

  const [tab, setTab] = useState<TabId>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeStatus>('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [presenceFilter, setPresenceFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name-asc');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ employee: Employee; next: EmployeeStatus } | null>(null);
  const [attendanceEmployeeFilter, setAttendanceEmployeeFilter] = useState('all');

  const today = todayISO();

  const activityByEmployee = useMemo(() => {
    const map = new Map<string, { assigned: number; finished: number }>();
    for (const e of employees) {
      const assigned = getEmployeeAssignedOrders(orders, e);
      map.set(e.id, { assigned: assigned.length, finished: assigned.filter(isOrderFinished).length });
    }
    return map;
  }, [employees, orders]);

  const pointableIds = useMemo(
    () => employees.filter((e) => e.status !== 'inactive').map((e) => e.id),
    [employees]
  );
  const todaySummary = useMemo(
    () => summarizeAttendance(attendanceRecords, pointableIds, today),
    [attendanceRecords, pointableIds, today]
  );
  const activeCount = employees.filter((e) => e.status === 'active').length;

  const filteredEmployees = useMemo(() => {
    const term = normalizeText(searchTerm);
    const list = employees.filter((e) => {
      if (term) {
        const matches =
          normalizeText(e.fullName).includes(term) ||
          normalizeText(e.position).includes(term) ||
          (e.phone ? e.phone.replace(/\s/g, '').includes(term.replace(/\s/g, '')) : false);
        if (!matches) return false;
      }
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (positionFilter !== 'all' && e.position !== positionFilter) return false;
      if (presenceFilter !== 'all' && getAttendanceStatus(attendanceRecords, e.id, today) !== presenceFilter) return false;
      return true;
    });

    switch (sortKey) {
      case 'name-desc':
        list.sort((a, b) => b.fullName.localeCompare(a.fullName, 'fr'));
        break;
      case 'activity':
        list.sort((a, b) => (activityByEmployee.get(b.id)?.assigned ?? 0) - (activityByEmployee.get(a.id)?.assigned ?? 0));
        break;
      case 'hired':
        list.sort((a, b) => (a.hiredAt ?? '9999').localeCompare(b.hiredAt ?? '9999'));
        break;
      case 'name-asc':
      default:
        list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));
    }
    return list;
  }, [employees, searchTerm, statusFilter, positionFilter, presenceFilter, sortKey, attendanceRecords, today, activityByEmployee]);

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'all' || positionFilter !== 'all' || presenceFilter !== 'all';
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPositionFilter('all');
    setPresenceFilter('all');
  };

  const detailEmployee = detailEmployeeId ? employees.find((e) => e.id === detailEmployeeId) ?? null : null;

  const openCreate = () => {
    setEditingEmployee(null);
    setFormOpen(true);
  };
  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormOpen(true);
  };
  const requestToggleActive = (employee: Employee) => {
    setStatusConfirm({ employee, next: employee.status === 'inactive' ? 'active' : 'inactive' });
  };

  const inputClass =
    'border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900';

  const renderActions = (employee: Employee) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setDetailEmployeeId(employee.id)}
        aria-label={`Consulter la fiche de ${employee.fullName}`}
        title="Consulter"
        className="p-2 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => openEdit(employee)}
        aria-label={`Modifier ${employee.fullName}`}
        title="Modifier"
        className="p-2 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => requestToggleActive(employee)}
        aria-label={employee.status === 'inactive' ? `Réactiver ${employee.fullName}` : `Désactiver ${employee.fullName}`}
        title={employee.status === 'inactive' ? 'Réactiver' : 'Désactiver'}
        className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
          employee.status === 'inactive'
            ? 'text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-600'
            : 'text-red-500 hover:bg-red-50 focus:ring-red-600'
        }`}
      >
        {employee.status === 'inactive' ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <PageHeader
        title="Personnel"
        subtitle="Gérez les employés et leur activité"
        onBack={() => setActiveScreen('dashboard')}
        action={
          <button
            type="button"
            onClick={openCreate}
            className="bg-[#09090b] text-white rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 transition-colors shadow flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un employé</span>
          </button>
        }
      />

      <LocalDataNotice />

      {/* KPI du jour, calculés depuis les saisies réelles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Employés actifs" value={String(activeCount)} hint={`${employees.length} fiche(s) au total`} />
        <KpiCard
          label="Présents aujourd’hui"
          value={String(todaySummary.present + todaySummary.late)}
          hint={todaySummary.late > 0 ? `dont ${todaySummary.late} en retard` : 'aucun retard saisi'}
          tone="success"
        />
        <KpiCard
          label="Absents / congés déclarés"
          value={String(todaySummary.absent + todaySummary.leave)}
          hint={`${todaySummary.absent} absent(s) · ${todaySummary.leave} congé(s)`}
          tone={todaySummary.absent > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Non renseignés aujourd’hui"
          value={String(todaySummary.unrecorded)}
          hint="pointage pas encore saisi"
        />
      </div>

      {/* Onglets par contexte : l'équipe (fiches) · le pointage (présences) */}
      <Tabs
        ariaLabel="Sections du module Personnel"
        className="mb-3"
        activeId={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'list',
            label: 'Équipe',
            icon: <Users className="w-4 h-4" aria-hidden="true" />,
            badge: filteredEmployees.length,
          },
          {
            id: 'attendance',
            label: 'Présences',
            icon: <ClipboardList className="w-4 h-4" aria-hidden="true" />,
            badge: todaySummary.unrecorded > 0 ? `${todaySummary.unrecorded} à saisir` : undefined,
          },
        ]}
      />

      {tab === 'attendance' ? (
        <AttendanceSection
          employeeFilterId={attendanceEmployeeFilter}
          onEmployeeFilterChange={setAttendanceEmployeeFilter}
          onOpenEmployee={(e) => setDetailEmployeeId(e.id)}
        />
      ) : (
        <div className="bg-white border border-zinc-200/90 rounded-xl overflow-hidden shadow-2xs">
          {/* Recherche et filtres */}
          <div className="p-3 border-b border-zinc-200 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <label htmlFor="emp-search" className="sr-only">Rechercher un employé</label>
              <input
                id="emp-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher nom, poste, téléphone…"
                className="border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 text-[12.5px] w-72 max-w-full focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <label htmlFor="emp-status-filter" className="sr-only">Filtrer par statut</label>
            <select id="emp-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | EmployeeStatus)} className={inputClass}>
              <option value="all">Statut : tous</option>
              {(Object.keys(EMPLOYEE_STATUS_LABELS) as EmployeeStatus[]).map((s) => (
                <option key={s} value={s}>{EMPLOYEE_STATUS_LABELS[s]}</option>
              ))}
            </select>

            <label htmlFor="emp-position-filter" className="sr-only">Filtrer par poste</label>
            <select id="emp-position-filter" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} className={inputClass}>
              <option value="all">Poste : tous</option>
              {EMPLOYEE_POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <label htmlFor="emp-presence-filter" className="sr-only">Filtrer par présence du jour</label>
            <select id="emp-presence-filter" value={presenceFilter} onChange={(e) => setPresenceFilter(e.target.value)} className={inputClass}>
              <option value="all">Aujourd’hui : toutes présences</option>
              <option value="present">Présents</option>
              <option value="late">En retard</option>
              <option value="absent">Absents</option>
              <option value="leave">En congé</option>
              <option value="unrecorded">Non renseignés</option>
            </select>

            <label htmlFor="emp-sort" className="sr-only">Trier la liste</label>
            <select id="emp-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={inputClass}>
              <option value="name-asc">Tri : nom A → Z</option>
              <option value="name-desc">Tri : nom Z → A</option>
              <option value="activity">Tri : activité atelier</option>
              <option value="hired">Tri : date d’entrée</option>
            </select>

            {hasActiveFilters && <ResetFiltersButton onClick={resetFilters} />}
            <span className="text-[12px] text-zinc-500 font-medium ml-auto tabular-nums">
              {filteredEmployees.length} employé(s)
            </span>
          </div>

          {employees.length === 0 ? (
            <EmptyState
              title="Aucun employé enregistré"
              description="Ajoutez votre premier employé pour commencer le suivi du personnel et des présences."
              action={
                <button
                  type="button"
                  onClick={openCreate}
                  className="bg-[#09090b] text-white rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 transition-colors shadow focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  Ajouter un employé
                </button>
              }
            />
          ) : filteredEmployees.length === 0 ? (
            <EmptyState
              title="Aucun résultat pour cette recherche"
              description="Aucun employé ne correspond à la combinaison de recherche et de filtres actuelle."
              action={<ResetFiltersButton onClick={resetFilters} />}
            />
          ) : (
            <>
              {/* Tableau (ordinateur / tablette) */}
              <Frame className="hidden md:block">
                <FramePanel className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Employé</TableHead>
                      <TableHead>Poste</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Aujourd’hui</TableHead>
                      <TableHead>Activité atelier</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => {
                      const presence = getAttendanceStatus(attendanceRecords, employee.id, today);
                      const activity = activityByEmployee.get(employee.id) ?? { assigned: 0, finished: 0 };
                      return (
                        <TableRow
                          key={employee.id}
                          onClick={() => setDetailEmployeeId(employee.id)}
                          className="hover:bg-zinc-50/70 cursor-pointer transition-colors"
                        >
                          <TableCell className="px-4">
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Avatar size="sm" aria-hidden="true"><AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback></Avatar>
                              <span className="font-bold text-zinc-900 truncate">{employee.fullName}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-600">{employee.position}</TableCell>
                          <TableCell className="text-zinc-600 tabular-nums">{employee.phone ?? 'Non renseigné'}</TableCell>
                          <TableCell>
                            <Badge size="sm" className={EMPLOYEE_STATUS_BADGE[employee.status]}>{EMPLOYEE_STATUS_LABELS[employee.status]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge size="sm" className={ATTENDANCE_STATUS_BADGE[presence]}>{ATTENDANCE_STATUS_LABELS[presence]}</Badge>
                          </TableCell>
                          <TableCell className="text-zinc-600 tabular-nums">
                            {activity.assigned === 0
                              ? 'Aucune commande connue'
                              : `${activity.assigned} affectée(s) · ${activity.finished} terminée(s)`}
                          </TableCell>
                          <TableCell className="text-right">{renderActions(employee)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </FramePanel>
              </Frame>

              {/* Cartes (mobile) */}
              <div className="md:hidden grid grid-cols-1 gap-3 p-3">
                {filteredEmployees.map((employee) => {
                  const presence = getAttendanceStatus(attendanceRecords, employee.id, today);
                  const activity = activityByEmployee.get(employee.id) ?? { assigned: 0, finished: 0 };
                  return (
                    <div
                      key={employee.id}
                      onClick={() => setDetailEmployeeId(employee.id)}
                      className="border border-zinc-200 rounded-xl p-3.5 bg-zinc-50/40"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar aria-hidden="true"><AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[14px] text-zinc-900 truncate">{employee.fullName}</p>
                          <p className="text-[12px] text-zinc-500">{employee.position}</p>
                        </div>
                        {renderActions(employee)}
                      </div>
                      <p className="flex items-center gap-1.5 text-[12px] text-zinc-600 mt-2">
                        <Phone className="w-3 h-3 text-zinc-400" />
                        <span className="tabular-nums">{employee.phone ?? 'Non renseigné'}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <Badge size="sm" className={EMPLOYEE_STATUS_BADGE[employee.status]}>{EMPLOYEE_STATUS_LABELS[employee.status]}</Badge>
                        <Badge size="sm" className={ATTENDANCE_STATUS_BADGE[presence]}>Auj. : {ATTENDANCE_STATUS_LABELS[presence]}</Badge>
                        <span className="text-[11.5px] text-zinc-500 tabular-nums ml-auto">
                          {activity.assigned === 0 ? 'Aucune activité connue' : `${activity.assigned} cmd · ${activity.finished} terminée(s)`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {formOpen && <EmployeeFormModal employee={editingEmployee} onClose={() => setFormOpen(false)} />}

      {detailEmployee && (
        <EmployeeDetailPanel
          employee={detailEmployee}
          onClose={() => setDetailEmployeeId(null)}
          onEdit={openEdit}
          onToggleActive={requestToggleActive}
          onViewAttendance={(e) => {
            setAttendanceEmployeeFilter(e.id);
            setTab('attendance');
            setDetailEmployeeId(null);
          }}
        />
      )}

      {statusConfirm && (
        <ConfirmModal
          title={statusConfirm.next === 'inactive' ? 'Désactiver cet employé ?' : 'Réactiver cet employé ?'}
          description={
            statusConfirm.next === 'inactive' ? (
              <>
                <strong>{statusConfirm.employee.fullName}</strong> ne pourra plus être pointé dans les
                présences. Sa fiche et son historique restent conservés et consultables.
              </>
            ) : (
              <>
                <strong>{statusConfirm.employee.fullName}</strong> redeviendra actif et pourra de nouveau
                être pointé dans les présences.
              </>
            )
          }
          confirmLabel={statusConfirm.next === 'inactive' ? 'Oui, désactiver' : 'Oui, réactiver'}
          danger={statusConfirm.next === 'inactive'}
          onCancel={() => setStatusConfirm(null)}
          onConfirm={() => {
            setEmployeeStatus(statusConfirm.employee.id, statusConfirm.next);
            setStatusConfirm(null);
          }}
        />
      )}
    </div>
  );
};
