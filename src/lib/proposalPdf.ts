import nb from '@/i18n/nb';
import type { CommunityProject } from '@/domain/community';
import { esc, pdfPage } from './pdf';

/**
 * «Forslag til kommunen» as a one-page PDF (0108): the proposal, how many neighbours support it, and the names
 * of those who chose to show them. Never addresses or contact details.
 */
export function proposalPdfHtml(p: CommunityProject, supporters: number, names: string[], made = new Date()): string {
  const t = nb.felles.projects;
  const body = `
    <h1>${esc(t.pdfTitle(p.title))}</h1>
    <p class="lead">${esc(t.pdfIntro(p.municipality, supporters))}</p>
    <p>${esc(p.body).replace(/\n/g, '<br>')}</p>
    ${p.steps.length ? `<ol>${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    <h2>${esc(t.pdfNames)}</h2>
    ${names.length ? `<ul class="names">${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : `<p>${esc(t.pdfNoNames)}</p>`}
    <p class="foot">${esc(t.pdfFooter)} · ${esc(made.toLocaleDateString('nb-NO'))}</p>`;
  return pdfPage(t.pdfTitle(p.title), body, '.lead{font-size:13pt;font-weight:600}.names{columns:2}.foot{margin-top:28px;color:#6B7280;font-size:10pt}');
}
