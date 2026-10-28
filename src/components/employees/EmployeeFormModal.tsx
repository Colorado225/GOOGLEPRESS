import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { EMPLOYEE_POSITIONS, Employee, EmployeeFormData, EmployeeStatus } from '../../types';
import { isValidISODate, todayISO } from '../../lib/dates';
import { UserPlus, Save } from 'lucide-react';
import { EMPLOYEE_STATUS_LABELS } from './employeeLabels';

interface EmployeeFormModalProps {
  /** Employé à modifier, ou null pour une création. */
  employee: Employee | null;
  onClose: () => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({ employee, onClose }) => {
  const { addEmployee, updateEmployee } = useApp();
  const isEdit = employee !== null;

  const initial: EmployeeFormData = useMemo(
    () => ({
      fullName: employee?.fullName ?? '',
      phone: employee?.phone ?? '',
      position: employee?.position ?? 'Réception',
      status: employee?.status ?? 'active',
      hiredAt: employee?.hiredAt ?? '',
      notes: employee?.notes ?? '',
    }),
    [employee]
  );

  const [form, setForm] = useState<EmployeeFormData>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  const validateField = (field: keyof EmployeeFormData, value: string): string | undefined => {
    switch (field) {
      case 'fullName':
        return value.trim().length === 0 ? 'Le nom complet est obligatoire.' : undefined;
      case 'position':
        return (EMPLOYEE_POSITIONS as readonly string[]).includes(value)
          ? undefined
          : 'Choisissez un poste dans la liste proposée.';
      case 'phone': {
        const v = value.trim();
        if (!v) return undefined; // optionnel
        return /^[+0-9][0-9\s.-]{7,}$/.test(v)
          ? undefined
          : 'Numéro invalide : chiffres, espaces et « + » uniquement (8 caractères min.).';
      }
      case 'hiredAt': {
        if (!value) return undefined; // optionnelle
        if (!isValidISODate(value)) return 'Date invalide.';
        if (value > todayISO()) return "La date d'entrée ne peut pas être dans le futur.";
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const setField = <K extends keyof EmployeeFormData>(field: K, value: EmployeeFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, String(value)) }));
    }
  };

  const blurField = (field: keyof EmployeeFormData) => {
    setErrors((prev) => ({ ...prev, [field]: validateField(field, String(form[field] ?? '')) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // anti double-clic

    const nextErrors: Partial<Record<keyof EmployeeFormData, string>> = {
      fullName: validateField('fullName', form.fullName),
      position: validateField('position', form.position),
      phone: validateField('phone', form.phone ?? ''),
      hiredAt: validateField('hiredAt', form.hiredAt ?? ''),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return; // le formulaire reste ouvert

    setIsSubmitting(true);
    const data: EmployeeFormData = {
      fullName: form.fullName.trim().replace(/\s+/g, ' '),
      phone: form.phone?.trim() || undefined,
      position: form.position,
      status: form.status,
      hiredAt: form.hiredAt || undefined,
      notes: form.notes?.trim() || undefined,
    };
    if (isEdit) updateEmployee(employee.id, data);
    else addEmployee(data);
    setIsSubmitting(false);
    onClose();
  };

  const inputClass = (hasError: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 ${
      hasError ? 'border-red-400 focus:ring-red-500' : 'border-zinc-300 dark:border-zinc-600 focus:ring-zinc-900 dark:focus:ring-zinc-100'
    }`;
  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const errorClass = 'text-[11.5px] text-red-600 dark:text-red-400 font-medium mt-1';

  return (
    <ModalShell
      title={isEdit ? 'Modifier un employé' : 'Ajouter un employé'}
      subtitle={isEdit ? employee.fullName : 'Nouvelle fiche personnel'}
      icon={<UserPlus className="w-5 h-5 text-blue-400" />}
      onClose={onClose}
      isDirty={isDirty}
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        <div>
          <label htmlFor="emp-name" className={labelClass}>Nom et prénom *</label>
          <input
            id="emp-name"
            type="text"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            onBlur={() => blurField('fullName')}
            placeholder="Ex : Awa Koné"
            aria-invalid={Boolean(errors.fullName)}
            className={inputClass(Boolean(errors.fullName))}
          />
          {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="emp-position" className={labelClass}>Poste *</label>
            <select
              id="emp-position"
              value={form.position}
              onChange={(e) => setField('position', e.target.value)}
              onBlur={() => blurField('position')}
              aria-invalid={Boolean(errors.position)}
              className={inputClass(Boolean(errors.position))}
            >
              {EMPLOYEE_POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.position && <p className={errorClass}>{errors.position}</p>}
          </div>

          <div>
            <label htmlFor="emp-status" className={labelClass}>Statut</label>
            <select
              id="emp-status"
              value={form.status}
              onChange={(e) => setField('status', e.target.value as EmployeeStatus)}
              className={inputClass(false)}
            >
              {(Object.keys(EMPLOYEE_STATUS_LABELS) as EmployeeStatus[]).map((s) => (
                <option key={s} value={s}>{EMPLOYEE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="emp-phone" className={labelClass}>Téléphone (optionnel)</label>
            <input
              id="emp-phone"
              type="tel"
              value={form.phone ?? ''}
              onChange={(e) => setField('phone', e.target.value)}
              onBlur={() => blurField('phone')}
              placeholder="Ex : 07 08 55 23 41"
              aria-invalid={Boolean(errors.phone)}
              className={inputClass(Boolean(errors.phone))}
            />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>

          <div>
            <label htmlFor="emp-hired" className={labelClass}>Date d’entrée (optionnelle)</label>
            <input
              id="emp-hired"
              type="date"
              value={form.hiredAt ?? ''}
              max={todayISO()}
              onChange={(e) => setField('hiredAt', e.target.value)}
              onBlur={() => blurField('hiredAt')}
              aria-invalid={Boolean(errors.hiredAt)}
              className={inputClass(Boolean(errors.hiredAt))}
            />
            {errors.hiredAt && <p className={errorClass}>{errors.hiredAt}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="emp-notes" className={labelClass}>Notes (optionnel)</label>
          <textarea
            id="emp-notes"
            value={form.notes ?? ''}
            onChange={(e) => setField('notes', e.target.value)}
            rows={2}
            placeholder="Informations utiles : spécialité, tournées, remarques…"
            className={inputClass(false)}
          />
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">* Champ obligatoire. Un champ laissé vide restera « Non renseigné » dans la fiche.</p>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 text-white dark:text-zinc-950 font-bold rounded-lg py-2.5 shadow transition-colors flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Enregistrement…' : 'Enregistrer'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
