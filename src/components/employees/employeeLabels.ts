import type { AttendanceRecord, AttendanceStatus, EmployeeStatus } from '../../types';

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  leave: 'En congé',
};

export const EMPLOYEE_STATUS_BADGE: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  leave: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  late: 'En retard',
  absent: 'Absent',
  leave: 'Congé',
  unrecorded: 'Non renseigné',
};

export const ATTENDANCE_STATUS_BADGE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  leave: 'bg-blue-50 text-blue-700 border-blue-200',
  unrecorded: 'bg-zinc-100 text-zinc-500 border-zinc-200',
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
