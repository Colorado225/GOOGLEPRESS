import React, { useMemo, useState } from 'react';
import { CalendarClock, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { SegmentedControl } from '../common/SegmentedControl';
import { formatFCFA } from '../../data/demoData';
import { isValidISODate, todayISO } from '../../lib/dates';
import { LOGISTICS_TIME_SLOTS, sortCourierCandidates } from '../../lib/logistics';
import type { LogisticsTask, LogisticsTimeSlot } from '../../types';

interface LogisticsTaskFormModalProps {
  /** null = nouveau ramassage ; tâche = modification / reprogrammation. */
  task: LogisticsTask | null;
  onClose: () => void;
}

type CustomerMode = 'existing' | 'new';

interface FormState {
  customerMode: CustomerMode;
  customerId: string;
  newCustomerName: string;
  newCustomerPhone: string;
  address: string;
  addressDetails: string;
  scheduledDate: string;
  timeSlot: LogisticsTimeSlot;
  assignedEmployeeId: string;
  estimatedBags: string;
  instructions: string;
}

const isValidPhone = (value: string): boolean => /^[+0-9][0-9\s.-]{7,}$/.test(value.trim());

export const LogisticsTaskFormModal: React.FC<LogisticsTaskFormModalProps> = ({ task, onClose }) => {
  const { customers, employees, shopSettings, createPickupTask, updateLogisticsTask } = useApp();
  const isEdit = task !== null;
  const isPickup = !task || task.kind === 'pickup';

  const courierCandidates = useMemo(() => sortCourierCandidates(employees), [employees]);
  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [customers]
  );

  const initial = useMemo<FormState>(
    () => ({
      customerMode: 'existing',
      customerId: task?.customerId ?? sortedCustomers[0]?.id ?? '',
      newCustomerName: '',
      newCustomerPhone: '',
      address: task?.address ?? sortedCustomers[0]?.address ?? '',
      addressDetails: task?.addressDetails ?? '',
      scheduledDate: task?.scheduledDate ?? todayISO(),
      timeSlot: task?.timeSlot ?? '10:00-12:00',
      assignedEmployeeId:
        task?.assignedEmployeeId &&
        courierCandidates.some((employee) => employee.id === task.assignedEmployeeId)
          ? task.assignedEmployeeId
          : '',
      estimatedBags: task?.estimatedBags ? String(task.estimatedBags) : '',
      instructions: task?.instructions ?? '',
    }),
    [courierCandidates, sortedCustomers, task]
  );

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setForm((prev) => ({
      ...prev,
      customerId,
      address: customer?.address ?? prev.address,
    }));
    setErrors((prev) => ({ ...prev, customerId: undefined, address: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!isEdit && form.customerMode === 'existing' && !form.customerId) {
      next.customerId = 'Sélectionnez un client.';
    }
    if (!isEdit && form.customerMode === 'new') {
      if (!form.newCustomerName.trim()) next.newCustomerName = 'Le nom du client est obligatoire.';
      if (!form.newCustomerPhone.trim()) next.newCustomerPhone = 'Le téléphone est obligatoire.';
      else if (!isValidPhone(form.newCustomerPhone)) {
        next.newCustomerPhone = 'Numéro invalide : chiffres, espaces et « + » uniquement.';
      }
    }
    if (!form.address.trim()) next.address = 'L’adresse est obligatoire.';
    if (!isValidISODate(form.scheduledDate)) next.scheduledDate = 'Date invalide.';
    else if (form.scheduledDate < todayISO()) next.scheduledDate = 'La date doit être aujourd’hui ou plus tard.';
    if (form.estimatedBags.trim()) {
      const bags = Number(form.estimatedBags);
      if (!Number.isInteger(bags) || bags < 1 || bags > 99) {
        next.estimatedBags = 'Indiquez un nombre entier entre 1 et 99, ou laissez vide.';
      }
    }
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);

    const schedule = {
      address: form.address,
      addressDetails: form.addressDetails || undefined,
      scheduledDate: form.scheduledDate,
      timeSlot: form.timeSlot,
      assignedEmployeeId: form.assignedEmployeeId || undefined,
      estimatedBags: form.estimatedBags.trim() ? Number(form.estimatedBags) : undefined,
      instructions: form.instructions || undefined,
    };

    const result = isEdit
      ? updateLogisticsTask(task.id, schedule)
      : createPickupTask({
          ...schedule,
          customerMode: form.customerMode,
          customerId: form.customerMode === 'existing' ? form.customerId : undefined,
          newCustomerName: form.customerMode === 'new' ? form.newCustomerName : undefined,
          newCustomerPhone: form.customerMode === 'new' ? form.newCustomerPhone : undefined,
        });

    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    onClose();
  };

  const inputClass = (hasError = false) =>
    `w-full border rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-400 focus:ring-red-500'
        : 'border-zinc-300 dark:border-zinc-600 focus:ring-zinc-900 dark:focus:ring-zinc-100'
    }`;
  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const errorClass = 'text-[11.5px] text-red-600 dark:text-red-400 font-medium mt-1';

  return (
    <ModalShell
      title={
        isEdit
          ? isPickup
            ? 'Modifier le ramassage'
            : 'Modifier la livraison'
          : 'Nouveau ramassage à domicile'
      }
      subtitle={
        isEdit
          ? `${task.customerName}${task.orderTicketNumber ? ` • ${task.orderTicketNumber}` : ''}`
          : 'Réservation prise au comptoir ou par téléphone'
      }
      icon={<CalendarClock className="w-5 h-5 text-blue-400" aria-hidden="true" />}
      onClose={onClose}
      isDirty={isDirty}
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        {!isEdit && (
          <>
            <div>
              <span className={labelClass}>Client</span>
              <SegmentedControl<CustomerMode>
                ariaLabel="Choisir entre un client existant et un nouveau client"
                options={[
                  { id: 'existing', label: 'Client existant' },
                  { id: 'new', label: 'Nouveau client' },
                ]}
                value={form.customerMode}
                onChange={(mode) => setField('customerMode', mode)}
              />
            </div>

            {form.customerMode === 'existing' ? (
              <div>
                <label htmlFor="logistics-customer" className={labelClass}>Fiche client *</label>
                <select
                  id="logistics-customer"
                  value={form.customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  aria-invalid={Boolean(errors.customerId)}
                  className={inputClass(Boolean(errors.customerId))}
                >
                  <option value="">Sélectionnez un client…</option>
                  {sortedCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} — {customer.phone}
                    </option>
                  ))}
                </select>
                {errors.customerId && <p className={errorClass}>{errors.customerId}</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="logistics-new-name" className={labelClass}>Nom du client *</label>
                  <input
                    id="logistics-new-name"
                    type="text"
                    value={form.newCustomerName}
                    onChange={(e) => setField('newCustomerName', e.target.value)}
                    placeholder="Ex : Aya Brou"
                    aria-invalid={Boolean(errors.newCustomerName)}
                    className={inputClass(Boolean(errors.newCustomerName))}
                  />
                  {errors.newCustomerName && <p className={errorClass}>{errors.newCustomerName}</p>}
                </div>
                <div>
                  <label htmlFor="logistics-new-phone" className={labelClass}>Téléphone *</label>
                  <input
                    id="logistics-new-phone"
                    type="tel"
                    value={form.newCustomerPhone}
                    onChange={(e) => setField('newCustomerPhone', e.target.value)}
                    placeholder="07 00 00 00 00"
                    aria-invalid={Boolean(errors.newCustomerPhone)}
                    className={inputClass(Boolean(errors.newCustomerPhone))}
                  />
                  {errors.newCustomerPhone && <p className={errorClass}>{errors.newCustomerPhone}</p>}
                </div>
              </div>
            )}
          </>
        )}

        {isEdit && (
          <p className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
            Client : <strong className="text-zinc-900 dark:text-zinc-100">{task.customerName}</strong> •{' '}
            {task.customerPhone}. Frais déjà promis :{' '}
            <strong className="text-zinc-900 dark:text-zinc-100">
              {task.fee > 0 ? formatFCFA(task.fee) : 'offert'}
            </strong>{' '}
            (non modifiable ici).
          </p>
        )}

        <div>
          <label htmlFor="logistics-address" className={labelClass}>
            {isPickup ? 'Adresse de ramassage *' : 'Adresse de livraison *'}
          </label>
          <input
            id="logistics-address"
            type="text"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="Quartier, rue, repère principal…"
            aria-invalid={Boolean(errors.address)}
            className={inputClass(Boolean(errors.address))}
          />
          {errors.address && <p className={errorClass}>{errors.address}</p>}
        </div>

        <div>
          <label htmlFor="logistics-address-details" className={labelClass}>
            Précisions pour le coursier
          </label>
          <input
            id="logistics-address-details"
            type="text"
            value={form.addressDetails}
            onChange={(e) => setField('addressDetails', e.target.value)}
            placeholder="Étage, portail, gardien, repère…"
            className={inputClass()}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="logistics-date" className={labelClass}>Date *</label>
            <input
              id="logistics-date"
              type="date"
              value={form.scheduledDate}
              min={todayISO()}
              onChange={(e) => setField('scheduledDate', e.target.value)}
              aria-invalid={Boolean(errors.scheduledDate)}
              className={inputClass(Boolean(errors.scheduledDate))}
            />
            {errors.scheduledDate && <p className={errorClass}>{errors.scheduledDate}</p>}
          </div>
          <div>
            <label htmlFor="logistics-slot" className={labelClass}>Créneau *</label>
            <select
              id="logistics-slot"
              value={form.timeSlot}
              onChange={(e) => setField('timeSlot', e.target.value as LogisticsTimeSlot)}
              className={inputClass()}
            >
              {LOGISTICS_TIME_SLOTS.map((slot) => (
                <option key={slot.id} value={slot.id}>{slot.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="logistics-employee" className={labelClass}>Coursier / employé</label>
            <select
              id="logistics-employee"
              value={form.assignedEmployeeId}
              onChange={(e) => setField('assignedEmployeeId', e.target.value)}
              className={inputClass()}
            >
              <option value="">À assigner plus tard</option>
              {courierCandidates.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} — {employee.position}
                </option>
              ))}
            </select>
            {courierCandidates.length === 0 && (
              <p className="mt-1 text-[11.5px] text-amber-700 dark:text-amber-300">
                Aucun employé actif : la tournée pourra être créée, mais pas démarrée.
              </p>
            )}
          </div>

          {isPickup && (
            <div>
              <label htmlFor="logistics-bags" className={labelClass}>Sacs annoncés</label>
              <input
                id="logistics-bags"
                type="number"
                min={1}
                max={99}
                step={1}
                inputMode="numeric"
                value={form.estimatedBags}
                onChange={(e) => setField('estimatedBags', e.target.value)}
                placeholder="Non renseigné"
                aria-invalid={Boolean(errors.estimatedBags)}
                className={inputClass(Boolean(errors.estimatedBags))}
              />
              {errors.estimatedBags && <p className={errorClass}>{errors.estimatedBags}</p>}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="logistics-instructions" className={labelClass}>Consignes de tournée</label>
          <textarea
            id="logistics-instructions"
            value={form.instructions}
            onChange={(e) => setField('instructions', e.target.value)}
            rows={3}
            placeholder="Ex : appeler en arrivant, linge délicat annoncé, accès par le parking…"
            className={inputClass()}
          />
        </div>

        {!isEdit && (
          <p className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-2 text-[12px] leading-relaxed text-blue-900 dark:text-blue-100">
            Frais annoncé pour ce ramassage :{' '}
            <strong>{shopSettings.pickupFee > 0 ? formatFCFA(shopSettings.pickupFee) : 'offert'}</strong>.
            Aucun montant de prestations n’est promis avant l’arrivée du linge : la commande
            sera créée après le comptage à la boutique.
          </p>
        )}

        {submitError && (
          <p role="alert" className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-[12px] font-medium text-red-700 dark:text-red-300">
            {submitError}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold px-4 py-2.5 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold px-5 py-2.5 rounded-xl text-[13px] shadow disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            {isEdit ? 'Enregistrer la tournée' : 'Programmer le ramassage'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
