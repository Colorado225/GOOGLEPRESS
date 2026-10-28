/**
 * Impression ciblée : ajoute une classe sur <body> le temps de l'impression
 * pour que le CSS (@media print dans index.css) n'imprime que la zone visée
 * (reçu thermique 80 mm ou rapport A4), sans le reste de l'application.
 */
export type PrintKind = 'receipt' | 'report';

const PRINT_CLASSES: Record<PrintKind, string> = {
  receipt: 'printing-receipt',
  report: 'printing-report',
};

export function printDocument(kind: PrintKind): void {
  const cls = PRINT_CLASSES[kind];
  document.body.classList.add(cls);

  const cleanup = () => document.body.classList.remove(cls);
  window.addEventListener('afterprint', cleanup, { once: true });
  // Sécurité : certains navigateurs ne déclenchent pas afterprint si la
  // boîte de dialogue est annulée très vite — on retire la classe quand même.
  window.setTimeout(cleanup, 60_000);

  window.print();
}
