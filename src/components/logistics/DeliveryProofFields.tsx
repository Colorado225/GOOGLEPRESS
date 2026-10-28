import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, Eraser, Loader2, PenLine, Trash2 } from 'lucide-react';
import type { DeliveryProofSettings } from '../../types';
import type { DeliveryProofDraft } from '../../lib/deliveryProof';
import {
  MAX_PROOF_NOTE_LENGTH,
  MAX_PROOF_SIGNATURE_LENGTH,
  MAX_RECEIVER_NAME_LENGTH,
} from '../../lib/deliveryProof';
import { fileToGarmentImageDataUrl } from '../../lib/imageDownscale';

/**
 * Saisie de la preuve de remise par le coursier : photo du linge, nom du
 * réceptionnaire, code à 4 chiffres et signature au doigt.
 *
 * Le composant ne valide pas les obligations (photo/signature/code imposés) :
 * c'est `validateDeliveryProofDraft` qui tranche au moment de confirmer, côté
 * contexte. Ici on se contente de refuser ce qui est inutilisable (image
 * illisible, signature trop lourde) avec un message immédiat.
 */

interface DeliveryProofFieldsProps {
  value: DeliveryProofDraft;
  onChange: (next: DeliveryProofDraft) => void;
  settings: DeliveryProofSettings;
  /** Code attendu pour cette tournée ; absent = pas de code généré. */
  expectedCode?: string;
  onError?: (message: string) => void;
}

const labelClass =
  'block text-[11.5px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400 mb-1';
const inputClass =
  'w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100';

const SIGNATURE_WIDTH = 600;
const SIGNATURE_HEIGHT = 200;

export const DeliveryProofFields: React.FC<DeliveryProofFieldsProps> = ({
  value,
  onChange,
  settings,
  expectedCode,
  onError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);

  const update = (patch: Partial<DeliveryProofDraft>) => onChange({ ...value, ...patch });

  const handlePhoto = async (file: File | null | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      // 320 px suffisent pour reconnaître un vêtement ou un sac sur un litige,
      // tout en restant très en dessous du plafond de la data URL.
      const dataUrl = await fileToGarmentImageDataUrl(file, { size: 320, quality: 0.8 });
      update({ photoDataUrl: dataUrl });
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Cette photo ne peut pas être utilisée.');
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = canvasPoint(event);
    if (!canvas || !point) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    hasInkRef.current = true;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#0f172a';
      context.beginPath();
      context.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
      context.fill();
    }
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const point = canvasPoint(event);
    if (!canvas || !point) return;
    const context = canvas.getContext('2d');
    const previous = lastPointRef.current;
    if (!context || !previous) return;
    context.strokeStyle = '#0f172a';
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  };

  const finishSignature = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !hasInkRef.current) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > MAX_PROOF_SIGNATURE_LENGTH) {
      onError?.('La signature est trop lourde. Effacez-la et faites signer à nouveau, plus simplement.');
      return;
    }
    update({ signatureDataUrl: dataUrl });
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    lastPointRef.current = null;
    drawingRef.current = false;
    update({ signatureDataUrl: undefined });
  };

  const photoLabel = settings.requirePhoto ? 'Photo du linge remis *' : 'Photo du linge remis';
  const signatureLabel = settings.requireSignature
    ? 'Signature du réceptionnaire *'
    : 'Signature du réceptionnaire';
  const codeLabel = settings.requireCode
    ? 'Code de remise à 4 chiffres *'
    : 'Code de remise à 4 chiffres';

  return (
    <fieldset className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
      <legend className="px-1 text-[11.5px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Preuve de remise
      </legend>

      {/* Photo */}
      <div>
        <span className={labelClass}>{photoLabel}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            id="delivery-proof-photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => void handlePhoto(event.target.files?.[0])}
          />
          <label
            htmlFor="delivery-proof-photo"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-[12.5px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-100"
          >
            {photoBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="h-4 w-4" aria-hidden="true" />
            )}
            {value.photoDataUrl ? 'Remplacer la photo' : 'Prendre une photo'}
          </label>
          {value.photoDataUrl && (
            <>
              <img
                src={value.photoDataUrl}
                alt="Photo de remise du linge"
                className="h-12 w-12 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => update({ photoDataUrl: undefined })}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Retirer
              </button>
            </>
          )}
        </div>
        <p className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
          Photo compressée et conservée avec la tournée. {settings.requirePhoto ? 'Obligatoire.' : 'Recommandée.'}
        </p>
      </div>

      {/* Réceptionnaire */}
      <div>
        <label htmlFor="delivery-proof-receiver" className={labelClass}>
          Nom du réceptionnaire
        </label>
        <input
          id="delivery-proof-receiver"
          type="text"
          value={value.receiverName ?? ''}
          maxLength={MAX_RECEIVER_NAME_LENGTH}
          onChange={(event) => update({ receiverName: event.target.value })}
          placeholder="La personne qui reçoit le linge"
          className={inputClass}
        />
      </div>

      {/* Code */}
      {expectedCode ? (
        <div>
          <label htmlFor="delivery-proof-code" className={labelClass}>
            {codeLabel}
          </label>
          <input
            id="delivery-proof-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={value.codeEntered ?? ''}
            onChange={(event) => update({ codeEntered: event.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="0000"
            className={`${inputClass} max-w-[9rem] text-center text-[16px] font-bold tracking-[0.4em] tabular-nums`}
          />
          <p className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
            Code communiqué au client avec sa commande. Il figure sur la tournée, pas sur le ticket remis.
          </p>
        </div>
      ) : (
        settings.requireCode && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11.5px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            Aucun code n’a été généré pour cette tournée (créée avant l’option). Le code reste facultatif ici.
          </p>
        )
      )}

      {/* Signature */}
      <div>
        <span className={labelClass}>{signatureLabel}</span>
        {value.signatureDataUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <img
              src={value.signatureDataUrl}
              alt="Signature du réceptionnaire"
              className="h-14 rounded-md border border-zinc-200 bg-white object-contain dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={clearSignature}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
              Effacer
            </button>
          </div>
        ) : signatureOpen ? (
          <div>
            <canvas
              ref={canvasRef}
              width={SIGNATURE_WIDTH}
              height={SIGNATURE_HEIGHT}
              aria-label="Zone de signature : dessinez avec le doigt"
              className="h-[140px] w-full touch-none rounded-lg border border-dashed border-zinc-400 bg-white dark:border-zinc-500"
              onPointerDown={startSignature}
              onPointerMove={drawSignature}
              onPointerUp={finishSignature}
              onPointerCancel={finishSignature}
              onPointerLeave={finishSignature}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearSignature}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                Effacer le tracé
              </button>
              <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                Le tracé est enregistré dès que le doigt se lève.
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSignatureOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-[12.5px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Faire signer
          </button>
        )}
      </div>

      {/* Note */}
      <div>
        <label htmlFor="delivery-proof-note" className={labelClass}>
          Note du coursier
        </label>
        <textarea
          id="delivery-proof-note"
          rows={2}
          maxLength={MAX_PROOF_NOTE_LENGTH}
          value={value.note ?? ''}
          onChange={(event) => update({ note: event.target.value })}
          placeholder="Remise à un voisin, portail fermé, précision utile en cas de litige…"
          className={inputClass}
        />
      </div>

      {value.photoDataUrl && value.receiverName ? (
        <p className="flex items-start gap-1.5 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Preuve prête : elle sera attachée à la livraison à la confirmation.
        </p>
      ) : null}
    </fieldset>
  );
};
