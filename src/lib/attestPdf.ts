import nb from '@/i18n/nb';
import { colors } from '@/theme/theme';
import { esc, pdfPage } from './pdf';

export type AttestInput = {
  name: string;
  place?: string;
  jobs: number;
  /** average 1–5 and how many reviews */
  rating?: { average: number; count: number };
  /** «2026» or «mars 2026» */
  memberSince?: string;
  /** share of avtaler where they turned up, 0–100 */
  showsUp?: number;
  categories: { label: string; jobs: number }[];
  /** the quick tags people picked most in their reviews («Punktlig», «Ryddig») */
  tags: { label: string; count: number }[];
  /** a few approved review comments */
  quotes: { text: string; stars: number; when: string }[];
  madeAt: string;
};

const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));

/**
 * «Attest fra MinNabo» (0101): a one-page A4 a youth can attach to a CV or a job application.
 * The figures, the kinds of jobs, what the neighbours say. No contact details and no address.
 */
export function attestPdfHtml(a: AttestInput): string {
  const t = nb.attest;
  const facts = [
    { value: String(a.jobs), label: t.jobs },
    a.rating?.count ? { value: a.rating.average.toFixed(1).replace('.', ','), label: t.ratingOf(a.rating.count) } : null,
    a.showsUp != null ? { value: `${Math.round(a.showsUp)} %`, label: t.showsUp } : null,
    a.memberSince ? { value: a.memberSince, label: t.since } : null,
  ].filter((f): f is { value: string; label: string } => !!f);

  const body = `
<div class="head">
  <div>
    <div class="eyebrow">${esc(t.eyebrow)}</div>
    <h1>${esc(a.name)}</h1>
    <p class="lead">${esc(t.intro(a.name.split(' ')[0], a.place ?? ''))}</p>
  </div>
  <div class="seal" aria-hidden="true"><span>✓</span><small>MinNabo</small></div>
</div>

<div class="facts">${facts.map((f) => `<div class="fact"><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`).join('')}</div>

${a.categories.length ? `<h2>${esc(t.categories)}</h2>
<div class="chips">${a.categories.map((c) => `<span class="chip">${esc(c.label)} <em>${esc(t.jobsShort(c.jobs))}</em></span>`).join('')}</div>` : ''}

${a.tags.length ? `<h2>${esc(t.tags)}</h2>
<div class="chips">${a.tags.map((x) => `<span class="chip tag">${esc(x.label)} <em>×${x.count}</em></span>`).join('')}</div>` : ''}

${a.quotes.length ? `<h2>${esc(t.quotes)}</h2>
<div class="quotes">${a.quotes
    .map((q) => `<div class="quote"><div class="stars">${stars(q.stars)}</div><p>«${esc(q.text)}»</p><small>${esc(t.quoteWhen(q.when))}</small></div>`)
    .join('')}</div>` : ''}

<div class="about"><b>${esc(t.aboutTitle)}</b><br>${esc(t.footer)}</div>
<div class="sign"><span>${esc(t.madeAt(a.madeAt))}</span><span>${esc(t.verify)}</span></div>`;

  return pdfPage(t.docTitle, body, ATTEST_CSS);
}

const ATTEST_CSS = `
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-top: 10px; }
  .eyebrow { font-size: 10pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: ${colors.limeDeep}; }
  h1 { font-size: 28pt; margin: 4px 0 6px; }
  .lead { margin: 0; font-size: 12.5pt; color: ${colors.ink2}; max-width: 125mm; }
  .seal { flex: none; width: 84px; height: 84px; border-radius: 50%; background: ${colors.lime}; border: 4px solid ${colors.ink};
          display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-8deg); }
  .seal span { font-size: 26pt; line-height: 1; font-weight: 800; color: ${colors.ink}; }
  .seal small { font-size: 8pt; font-weight: 800; letter-spacing: .04em; color: ${colors.ink}; }
  .facts { display: flex; gap: 10px; margin: 22px 0 6px; }
  .fact { flex: 1; border-radius: 14px; background: ${colors.ink}; color: #fff; padding: 12px 14px; }
  .fact b { display: block; font-size: 20pt; line-height: 1.1; color: ${colors.lime}; }
  .fact span { font-size: 9.5pt; opacity: .85; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: .06em; color: ${colors.mute}; margin: 20px 0 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border-radius: 999px; background: ${colors.limeTint}; color: ${colors.ink}; padding: 5px 11px; font-size: 10.5pt; font-weight: 600; }
  .chip em { font-style: normal; color: ${colors.limeDeep}; font-weight: 700; margin-left: 2px; }
  .chip.tag { background: ${colors.cyanTint}; }
  .chip.tag em { color: ${colors.cyanDeep}; }
  .quotes { display: flex; flex-direction: column; gap: 8px; }
  .quote { border-left: 4px solid ${colors.lime}; background: ${colors.surface2}; border-radius: 0 12px 12px 0; padding: 10px 14px; page-break-inside: avoid; }
  .quote p { margin: 4px 0; font-size: 11.5pt; }
  .quote small { color: ${colors.mute}; font-size: 9pt; }
  .stars { color: #E8A317; letter-spacing: 1px; font-size: 11pt; }
  .about { margin-top: 22px; padding: 12px 14px; border-radius: 12px; border: 1px solid ${colors.hairline}; font-size: 10pt; color: ${colors.ink2}; }
  .sign { display: flex; justify-content: space-between; margin-top: 14px; font-size: 9pt; color: ${colors.mute}; }
`;
