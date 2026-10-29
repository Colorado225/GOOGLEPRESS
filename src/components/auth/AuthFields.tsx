import React from 'react';
import { Eye, EyeOff, Lock, TriangleAlert, type LucideIcon } from 'lucide-react';
import { getPasswordStrength } from '../../lib/passwordStrength';
import {
  authHintClassName,
  authInputClassName,
  authLabelClassName,
} from './authStyles';

/**
 * Champs de formulaire partagés par toutes les pages d'accès : libellé,
 * icône, aide, erreur, affichage du mot de passe, avertissement Verr. Maj.
 * et jauge de robustesse. Aucun état métier ici : les pages pilotent la
 * valeur et la validation.
 */

interface AuthTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  /** Élément aligné à droite du libellé (ex. « Mot de passe oublié ? »). */
  trailing?: React.ReactNode;
  autoFocus?: boolean;
}

export const AuthTextField: React.FC<AuthTextFieldProps> = ({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  disabled = false,
  required = false,
  optional = false,
  hint,
  error,
  trailing,
  autoFocus = false,
}) => {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={authLabelClassName}>
          {label}
          {optional ? (
            <span className="ml-1.5 text-[10.5px] font-semibold normal-case tracking-normal text-[#8B93A1] dark:text-zinc-400">
              (facultatif)
            </span>
          ) : null}
        </label>
        {trailing}
      </div>
      <div className="relative mt-1.5">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8B93A1] dark:text-zinc-400"
            aria-hidden="true"
          />
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${authInputClassName} ${Icon ? 'pl-11' : ''} ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 dark:border-red-500/70'
              : ''
          }`}
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className={authHintClassName}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
};

interface AuthPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  hint?: string;
  error?: string;
  /** Affiche la jauge de robustesse pendant la saisie (nouveau mot de passe). */
  showStrength?: boolean;
  trailing?: React.ReactNode;
  autoFocus?: boolean;
}

export const AuthPasswordField: React.FC<AuthPasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled = false,
  hint,
  error,
  showStrength = false,
  trailing,
  autoFocus = false,
}) => {
  const [visible, setVisible] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={authLabelClassName}>
          {label}
        </label>
        {trailing}
      </div>
      <div className="relative mt-1.5">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8B93A1] dark:text-zinc-400"
          aria-hidden="true"
        />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyUp={(event) => setCapsLock(event.getModifierState?.('CapsLock') ?? false)}
          onBlur={() => setCapsLock(false)}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${authInputClassName} pl-11 pr-12 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 dark:border-red-500/70'
              : ''
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
          title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute right-1.5 top-1/2 inline-flex h-8.5 w-8.5 -translate-y-1/2 items-center justify-center rounded-lg text-[#7A8290] transition hover:bg-[#F2EEE7] hover:text-[#111827] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          {visible ? (
            <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <Eye className="h-4.5 w-4.5" aria-hidden="true" />
          )}
        </button>
      </div>
      {capsLock ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          La touche Verr. Maj. semble activée.
        </p>
      ) : null}
      {showStrength ? <PasswordStrengthMeter password={value} /> : null}
      {hint ? (
        <p id={`${id}-hint`} className={authHintClassName}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
};

const STRENGTH_SEGMENT_CLASSES = [
  'bg-red-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-emerald-500',
] as const;

/** Jauge à quatre segments, affichée uniquement pendant la saisie. */
export const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const { score, label } = getPasswordStrength(password);
  const filledClass = STRENGTH_SEGMENT_CLASSES[Math.max(score, 1) - 1];

  return (
    <div className="mt-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index < score ? filledClass : 'bg-[#E7E2D9] dark:bg-white/10'
            }`}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="mt-1.5 text-[11.5px] font-semibold text-[#6B7280] dark:text-zinc-400"
      >
        Robustesse du mot de passe : <span className="font-black">{label}</span>
      </p>
    </div>
  );
};

/** Bandeau d'environnement : service d'authentification absent. */
