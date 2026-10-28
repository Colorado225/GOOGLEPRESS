import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KpiCard, ResetFiltersButton } from '../common/ModuleCommon';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Avatar, AvatarFallback } from '../common/DataTable';
import { EMPLOYEE_POSITIONS } from '../../types';
import { DateRange, enumerateDaysISO } from '../../lib/periods';
import { getEmployeeAssignedOrders, isOrderFinished, orderReceivedISO } from '../../lib/reports';
import { downloadCsv } from '../../lib/csv';
import { getInitials } from '../../lib/utils';
import { buildDailySeries, ReportCard, VerticalBars } from './reportWidgets';
import { Download } from 'lucide-react';

/**
 * Rapport personnel : présences saisies dans la période et activité atelier
 * connue (commandes dont le champ « assigné à » correspond au prénom).
 * Aucun classement de performance : les rôles ne sont pas comparables.
 * Les jours sans saisie sont comptés à part — jamais assimilés à des absences.
 */
export const EmployeeReport: React.FC<{ range: DateRange }> = ({ range }) => {
  const { employees, attendanceRecords, orders, showToast } = useApp();
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');

  const periodDays = enumerateDaysISO(range);

  const rows = useMemo(() => {
    return employees
      .filter((e) => (employeeFilter === 'all' || e.id === employeeFilter) && (positionFilter === 'all' || e.position === positionFilter))
      .map((employee) => {
        const records = attendanceRecords.filter(
          (r) => r.employeeId === employee.id && r.date >= range.startISO && r.date <= range.endISO
        );
        const present = records.filter((r) => r.status === 'present').length;
        const late = records.filter((r) => r.status === 'late').length;
        const absent = records.filter((r) => r.status === 'absent').length;
        const leave = records.filter((r) => r.status === 'leave').length;
        const recordedDates = new Set(records.map((r) => r.date));
        const unrecorded = periodDays.filter((d) => !recordedDates.has(d)).length;

        const assignedInPeriod = getEmployeeAssignedOrders(orders, employee).filter((o) => {
          const iso = orderReceivedISO(o);
          return iso !== null && iso >= range.startISO && iso <= range.endISO;
        });
        return {
          employee,
          present,
          late,
          absent,
          leave,
          unrecorded,
          assigned: assignedInPeriod.length,
          finished: assignedInPeriod.filter(isOrderFinished).length,
        };
      })
      .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName, 'fr'));
  }, [employees, attendanceRecords, orders, employeeFilter, positionFilter, range.startISO, range.endISO, periodDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          present: acc.present + r.present + r.late,
          absent: acc.absent + r.absent,
          leave: acc.leave + r.leave,
          unrecorded: acc.unrecorded + r.unrecorded,
        }),
        { present: 0, absent: 0, leave: 0, unrecorded: 0 }
      ),
    [rows]
  );

  const presentsByDay = useMemo(() => {
    const map = new Map<string, number>();
    const ids = new Set(rows.map((r) => r.employee.id));
    for (const rec of attendanceRecords) {
      if (!ids.has(rec.employeeId)) continue;
      if (rec.date < range.startISO || rec.date > range.endISO) continue;
      if (rec.status === 'present' || rec.status === 'late') {
        map.set(rec.date, (map.get(rec.date) ?? 0) + 1);
      }
    }
    return map;
  }, [rows, attendanceRecords, range.startISO, range.endISO]);
  const presentsSeries = buildDailySeries(range, presentsByDay, (v) => (v > 0 ? String(v) : ''));

  const exportCsv = () => {
    downloadCsv(
      `pressingpro-rapport-personnel-${range.startISO}-${range.endISO}.csv`,
      ['Employé', 'Poste', 'Statut fiche', 'Jours présent', 'dont en retard', 'Absences déclarées', 'Congés', 'Jours sans saisie (week-ends inclus)', 'Commandes affectées reçues sur la période', 'dont terminées'],
      rows.map((r) => [
        r.employee.fullName,
        r.employee.position,
        r.employee.status,
        r.present + r.late,
        r.late,
        r.absent,
        r.leave,
        r.unrecorded,
        r.assigned,
        r.finished,
      ])
    );
    showToast(`✓ Rapport personnel exporté (${rows.length} employé(s)) — données locales`);
  };

  const inputClass =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Jours de présence saisis" value={String(totals.present)} hint="présents + retards, sélection actuelle" tone="success" />
        <KpiCard label="Absences déclarées" value={String(totals.absent)} hint="saisies explicites uniquement" />
        <KpiCard label="Jours de congé saisis" value={String(totals.leave)} hint="sur la sélection" />
        <KpiCard label="Jours sans saisie" value={String(totals.unrecorded)} hint="« Non renseigné », week-ends inclus" />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-2 print:hidden">
        <label htmlFor="rep-emp" className="sr-only">Filtrer par employé</label>
        <select id="rep-emp" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={inputClass}>
          <option value="all">Tous les employés</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.fullName}{e.status === 'inactive' ? ' (inactif)' : ''}</option>
          ))}
        </select>
        <label htmlFor="rep-pos" className="sr-only">Filtrer par poste</label>
        <select id="rep-pos" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} className={inputClass}>
          <option value="all">Tous les postes</option>
          {EMPLOYEE_POSITIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {(employeeFilter !== 'all' || positionFilter !== 'all') && (
          <ResetFiltersButton
            onClick={() => {
              setEmployeeFilter('all');
              setPositionFilter('all');
            }}
          />
        )}
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <ReportCard title="Personnes présentes par jour" subtitle="Présents + arrivées en retard, selon les saisies effectuées">
        <VerticalBars
          data={presentsSeries}
          ariaLabel="Nombre de personnes présentes par jour"
          formatFullValue={(v) => `${v} personne(s) présente(s)`}
          emptyMessage="Aucune présence saisie sur cette période pour la sélection : saisissez les présences depuis Personnel → Présences."
        />
      </ReportCard>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl shadow-2xs overflow-hidden">
        <h3 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 px-4 pt-3.5">Présences et activité par employé</h3>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 px-4 pb-2">
          Tri alphabétique volontaire : les postes n’étant pas comparables, ce tableau n’est pas un classement de performance.
          L’activité = commandes reçues sur la période où la personne est « assignée à » l’atelier.
        </p>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px] text-zinc-500 dark:text-zinc-400">Aucun employé ne correspond aux filtres.</p>
        ) : (
          <Frame className="m-3 mt-1">
            <FramePanel className="p-0">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Employé</TableHead>
                  <TableHead className="text-right">Présent</TableHead>
                  <TableHead className="text-right">dont retard</TableHead>
                  <TableHead className="text-right">Absent déclaré</TableHead>
                  <TableHead className="text-right">Congé</TableHead>
                  <TableHead className="text-right">Sans saisie</TableHead>
                  <TableHead className="text-right">Cmd affectées</TableHead>
                  <TableHead className="text-right">dont terminées</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.employee.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/70 transition-colors">
                    <TableCell className="px-4">
                      <span className="flex items-center gap-2.5">
                        <Avatar size="sm" aria-hidden="true"><AvatarFallback>{getInitials(r.employee.fullName)}</AvatarFallback></Avatar>
                        <span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 block leading-tight">{r.employee.fullName}</span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{r.employee.position}{r.employee.status === 'inactive' ? ' · inactif' : ''}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{r.present + r.late}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{r.late}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{r.absent}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{r.leave}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-400 dark:text-zinc-500">{r.unrecorded}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.assigned === 0 ? '—' : r.assigned}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{r.assigned === 0 ? '—' : r.finished}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </FramePanel>
          </Frame>
        )}
      </div>
    </div>
  );
};
