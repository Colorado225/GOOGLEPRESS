import type { AttendanceRecord, AttendanceStatus, EmployeeStatus } from '../../types';

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  leave: 'En congé',
};

export const EMPLOYEE_STATUS_BADGE: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  inactive: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
  leave: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  late: 'En retard',
  absent: 'Absent',
  leave: 'Congé',
  unrecorded: 'Non renseigné',
};

export const ATTENDANCE_STATUS_BADGE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  late: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  absent: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  leave: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  unrecorded: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
};

/** Statut de présence d'un employé à une date ISO ('unrecorded' si aucune saisie). */
export function getAttendanceStatus(
  records: AttendanceRecord[],
  employeeId: string,
  dateISO: string
): AttendanceStatus {
  const record = records.find((r) => r.employeeId === employeeId && r.date === dateISO);
  return record ? record.status : 'unrecorded';
}

export function getAttendanceRecord(
  records: AttendanceRecord[],
  employeeId: string,
  dateISO: string
): AttendanceRecord | undefined {
  return records.find((r) => r.employeeId === employeeId && r.date === dateISO);
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  leave: number;
  unrecorded: number;
}

/** Résumé des présences d'une liste d'employés pour une date donnée. */
export function summarizeAttendance(
  records: AttendanceRecord[],
  employeeIds: string[],
  dateISO: string
): AttendanceSummary {
  const summary: AttendanceSummary = { present: 0, late: 0, absent: 0, leave: 0, unrecorded: 0 };
  for (const id of employeeIds) {
    summary[getAttendanceStatus(records, id, dateISO)] += 1;
  }
  return summary;
}
