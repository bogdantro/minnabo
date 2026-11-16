import nb from '@/i18n/nb';
import { esc, pdfPage, pdfRows } from './pdf';

export type AgreementPdfInput = {
  title: string;
  clientName: string;
  helperName: string;
  price: string;
  when?: string;
  duration?: string;
  /** the area only – never an exact address (rule 6) */
  place?: string;
  description?: string;
  caveats?: string;
  /** «Gjentas hver uke · til og med 30. sep» */
  repeat?: string;
  agreedAt: string;
  madeAt: string;
  cancelled?: boolean;
};

/** «Lagre som PDF» on an avtale. Nothing about payment except the fixed note (rule 4). */
export function agreementPdfHtml(a: AgreementPdfInput): string {
  const t = nb.avtalePdf;
  const body = `
<h1>${esc(a.title)}</h1>
<div class="meta">${esc(t.agreedAt(a.agreedAt))} · ${esc(t.madeAt(a.madeAt))}</div>
${a.cancelled ? `<div class="stamp off">${esc(t.cancelled)}</div>` : ''}
<div class="parties">
  <div class="party"><small>${esc(t.client)}</small><b>${esc(a.clientName)}</b></div>
  <div class="party"><small>${esc(t.helper)}</small><b>${esc(a.helperName)}</b></div>
</div>
<table>${pdfRows([
    [t.task, a.title],
    [t.price, a.price],
    [t.when, a.when],
    [t.duration, a.duration],
    [t.repeat, a.repeat],
    [t.place, a.place],
    [t.description, a.description],
    [t.caveats, a.caveats],
  ])}</table>
<div class="note">${esc(nb.giTilbud.payNote)}</div>
<div class="foot">${esc(t.footer)}</div>`;
  return pdfPage(t.docTitle, body);
}
