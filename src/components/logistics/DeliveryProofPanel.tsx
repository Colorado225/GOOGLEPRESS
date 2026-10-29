import React from 'react';
import { Camera, CheckCircle2, Info, KeyRound, PenLine, ShieldAlert } from 'lucide-react';
import type { LogisticsTask } from '../../types';
import { describeDeliveryProof, hasDeliveryProof } from '../../lib/deliveryProof';
import { formatLogisticsDateTime } from '../../lib/logistics';

/**
 * Fiche de preuve de remise, en lecture seule.
 *
 * Elle est volontairement bavarde sur ce qui **manque** : une livraison
 * confirmée sans photo, sans signature et sans code affiche « sans preuve
 * enregistrée » plutôt que de laisser croire à une preuve disparue.
 * C'est cette fiche qu'on ouvre en cas de litige « je n'ai jamais reçu mon
 * linge ».
 */
export const DeliveryProofPanel: React.FC<{ task: LogisticsTask }> = ({ task }) => {
  const proof = task.proof;
  const proofChannels = describeDeliveryProof(proof);

  if (task.status !== 'completed') {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[12.5px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        <p className="flex items-start gap-1.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            La preuve de remise sera disponible après la confirmation de la livraison par le
            coursier.
            {task.deliveryCode && (
              <>
                {' '}
                Code de remise à communiquer au client :{' '}
                <strong className="tabular-nums tracking-[0.3em]">{task.deliveryCode}</strong>
              </>
            )}
          </span>
        </p>
      </div>
    );
  }

  if (!hasDeliveryProof(proof)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <p className="flex items-start gap-1.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Remise confirmée par le coursier, sans preuve enregistrée.</strong> Aucune photo,
            signature ni code n’a été saisi. Le détail de la tournée reste consultable ci-dessous.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-[12.5px] text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">
      <div className="flex flex-wrap items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <strong>Preuve de remise</strong>
        <span className="font-normal opacity-80">— {proofChannels.join(' • ')}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-start gap-3">
        {proof?.photoDataUrl && (
          <figure className="shrink-0">
            <img
              src={proof.photoDataUrl}
              alt={`Photo de remise de la commande ${task.orderTicketNumber ?? task.customerName}`}
              className="h-20 w-20 rounded-md border border-emerald-200 bg-white object-cover dark:border-emerald-800"
            />
            <figcaption className="mt-1 flex items-center gap-1 text-[11px] opacity-80">
              <Camera className="h-3 w-3" aria-hidden="true" /> Photo
            </figcaption>
          </figure>
        )}
        {proof?.signatureDataUrl && (
          <figure className="shrink-0">
            <img
              src={proof.signatureDataUrl}
              alt="Signature du réceptionnaire"
              className="h-20 rounded-md border border-emerald-200 bg-white object-contain px-1 dark:border-emerald-800"
            />
            <figcaption className="mt-1 flex items-center gap-1 text-[11px] opacity-80">
              <PenLine className="h-3 w-3" aria-hidden="true" /> Signature
            </figcaption>
          </figure>
        )}

        <ul className="min-w-0 flex-1 space-y-0.5 text-[12px]">
          {proof?.receiverName && (
            <li>
              <span className="opacity-80">Réceptionné par : </span>
              <strong>{proof.receiverName}</strong>
            </li>
          )}
          {proof?.codeEntered && (
            <li className="flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Code de remise vérifié ({proof.codeEntered.length} chiffres)
              </span>
            </li>
          )}
          <li>
            <span className="opacity-80">Capturée le : </span>
            <strong>{formatLogisticsDateTime(proof?.capturedAt)}</strong>
          </li>
          {proof?.capturedByEmployeeName && (
            <li>
              <span className="opacity-80">Par : </span>
              <strong>{proof.capturedByEmployeeName}</strong>
            </li>
          )}
          {proof?.note && (
            <li>
              <span className="opacity-80">Note : </span>
              <em>« {proof.note} »</em>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};
