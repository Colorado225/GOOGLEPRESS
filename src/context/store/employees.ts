import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  ActionResult,
  AttendanceRecord,
  Employee,
  EmployeeFormData,
  EmployeeStatus,
} from '../../types';
import {
  INITIAL_ATTENDANCE,
  INITIAL_EMPLOYEES,
} from '../../data/demoData';
import { guardEmployeeCount } from '../../lib/planAccess';
import type { SubscriptionPlanId } from '../../lib/subscription';
import { createLocalId as genId, loadPersistedState, persistState } from '../../lib/localPersistence';
import { nowISODateTime } from '../../lib/dates';
import type { NotifyFn } from './types';

export interface EmployeesDeps {
  storageKey: (name: string) => string;
  seedList: <T>(demoValue: readonly T[]) => T[];
  effectivePlanId: SubscriptionPlanId;
  notify: NotifyFn;
}

export interface EmployeesStore {
  employees: Employee[];
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  attendanceRecords: AttendanceRecord[];
  setAttendanceRecords: Dispatch<SetStateAction<AttendanceRecord[]>>;
  addEmployee: (data: EmployeeFormData) => ActionResult & { employee?: Employee };
  updateEmployee: (id: string, data: EmployeeFormData) => boolean;
  setEmployeeStatus: (id: string, status: EmployeeStatus) => void;
  upsertAttendance: (
    employeeId: string,
    date: string,
    status: AttendanceRecord['status'],
    extra?: { arrivalTime?: string; reason?: string }
  ) => void;
  removeAttendance: (employeeId: string, date: string) => void;
}

/**
 * Module Personnel : registre des employés et saisie des présences.
 * La copie locale est relayée par la sauvegarde d'agence ; l'ajout d'un compte
 * respecte le plafond de la formule effective.
 */
export const useEmployeesStore = ({
  storageKey,
  seedList,
  effectivePlanId,
  notify,
}: EmployeesDeps): EmployeesStore => {
  const [employees, setEmployees] = useState<Employee[]>(() =>
    loadPersistedState(storageKey('pressingpro_employees'), seedList(INITIAL_EMPLOYEES))
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    loadPersistedState(storageKey('pressingpro_attendance'), seedList(INITIAL_ATTENDANCE))
  );

  useEffect(() => {
    persistState(storageKey('pressingpro_employees'), employees);
  }, [employees]);
  useEffect(() => {
    persistState(storageKey('pressingpro_attendance'), attendanceRecords);
  }, [attendanceRecords]);

  const addEmployee = (
    data: EmployeeFormData
  ): ActionResult & { employee?: Employee } => {
    const guard = guardEmployeeCount(employees.length, effectivePlanId);
    if (!guard.allowed) return { ok: false, error: guard.message };
    const now = nowISODateTime();
    const employee: Employee = { ...data, id: genId('emp'), createdAt: now, updatedAt: now };
    setEmployees((prev) => [employee, ...prev]);
    notify(`✓ Employé ajouté : ${employee.fullName}`);
    return { ok: true, employee };
  };

  const updateEmployee = (id: string, data: EmployeeFormData): boolean => {
    let found = false;
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return { ...e, ...data, id: e.id, updatedAt: nowISODateTime() };
      })
    );
    if (found) notify('✓ Fiche employé mise à jour');
    return found;
  };

  const setEmployeeStatus = (id: string, status: EmployeeStatus) => {
    const employee = employees.find((e) => e.id === id);
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status, updatedAt: nowISODateTime() } : e))
    );
    if (employee) {
      notify(
        status === 'inactive'
          ? `Employé désactivé : ${employee.fullName}`
          : status === 'leave'
          ? `${employee.fullName} marqué en congé`
          : `✓ Employé réactivé : ${employee.fullName}`
      );
    }
  };

  /** Unicité (employé, date) : une correction remplace la saisie existante. */
  const upsertAttendance = (
    employeeId: string,
    date: string,
    status: AttendanceRecord['status'],
    extra?: { arrivalTime?: string; reason?: string }
  ) => {
    setAttendanceRecords((prev) => {
      const existing = prev.find((r) => r.employeeId === employeeId && r.date === date);
      if (existing) {
        return prev.map((r) =>
          r.id === existing.id
            ? { ...r, status, arrivalTime: extra?.arrivalTime, reason: extra?.reason }
            : r
        );
      }
      return [
        ...prev,
        { id: genId('att'), employeeId, date, status, arrivalTime: extra?.arrivalTime, reason: extra?.reason },
      ];
    });
    notify('✓ Présence enregistrée');
  };

  const removeAttendance = (employeeId: string, date: string) => {
    setAttendanceRecords((prev) =>
      prev.filter((r) => !(r.employeeId === employeeId && r.date === date))
    );
    notify('Saisie de présence effacée (retour à « Non renseigné »)');
  };

  return {
    employees,
    setEmployees,
    attendanceRecords,
    setAttendanceRecords,
    addEmployee,
    updateEmployee,
    setEmployeeStatus,
    upsertAttendance,
    removeAttendance,
  };
};
