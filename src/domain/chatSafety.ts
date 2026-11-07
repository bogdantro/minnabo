/**
 * What the chat can see in a message without sending it anywhere: links and phone numbers to make
 * tappable, and the warnings. Everything runs on the phone. The warnings never block a message:
 * a neighbour who types «Storgata 12» may have every reason to.
 */

export type TextPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'phone'; text: string; tel: string };

// https://…, www.… and bare domains ending in a known TLD. "hytte.Har" and "N.Nordmann" are not links.
const LINK = /\b(?:https?:\/\/[^\s<>]+|www\.[^\s<>]+|[a-z0-9-]+\.(?:no|com|net|org|io|app|se|dk)(?![a-zæøå0-9-])(?:\/[^\s<>]*)?)/gi;
// Norwegian mobile/landline: 8 digits, in the usual groupings, optionally +47 / 0047.
const PHONE = /(?<![\d.,])(?:(?:\+|00)47[\s-]?)?(?:\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}|\d{3}[\s-]?\d{2}[\s-]?\d{3})(?![\d.,]*\d)/g;

const trimLinkEnd = (raw: string) => raw.replace(/[.,;:!?)»"']+$/, '');

type Hit = { start: number; end: number; part: TextPart };

/** "Se finn.no/123 eller ring 912 34 567" → text, link, text, phone. */
export function splitMessage(text: string): TextPart[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(LINK)) {
    const raw = trimLinkEnd(m[0]);
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    hits.push({ start: m.index, end: m.index + raw.length, part: { kind: 'link', text: raw, url } });
  }
  for (const m of text.matchAll(PHONE)) {
    const start = m.index;
    if (hits.some((h) => start >= h.start && start < h.end)) continue;
    const digits = m[0].replace(/[\s-]/g, '').replace(/^00/, '+');
    hits.push({ start, end: start + m[0].length, part: { kind: 'phone', text: m[0], tel: digits } });
  }
  hits.sort((a, b) => a.start - b.start);

  const parts: TextPart[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start > at) parts.push({ kind: 'text', text: text.slice(at, h.start) });
    parts.push(h.part);
    at = h.end;
  }
  if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}

/** Lookalikes matter: "minnaboapp.no.svindel.ru" must not count as ours. */
export function isOwnLink(url: string): boolean {
  const host = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0].toLowerCase();
  return host === 'minnaboapp.no' || host.endsWith('.minnaboapp.no');
}

// Word stems, so «forskuddet» and «forskuddsbetaling» are caught too.
const MONEY = /\b(forskudd\w*|betal\w*\s+(før|først|på forhånd|i forkant|nå|inn)|på forhånd|depositum\w*|gebyr\w*|send\s+penger|overfør\w*)\b/i;
// 11 digits with or without the usual dots: a Norwegian account number
const ACCOUNT = /\b\d{4}[. ]?\d{2}[. ]?\d{5}\b/;
const CODES = /\b(bankid|engangskode|passord|kortnummer|kodebrikke)\b/i;

export type ScamSignal = 'MONEY' | 'ACCOUNT' | 'CODES' | 'LINK';

/** Only before an avtale: afterwards a price and a Vipps number are what people are meant to share. */
export function scamSignals(text: string, hasAgreement: boolean): ScamSignal[] {
  if (hasAgreement || !text) return [];
  const out: ScamSignal[] = [];
  if (MONEY.test(text)) out.push('MONEY');
  if (ACCOUNT.test(text)) out.push('ACCOUNT');
  if (CODES.test(text)) out.push('CODES');
  if (splitMessage(text).some((p) => p.kind === 'link' && !isOwnLink(p.url))) out.push('LINK');
  return out;
}

// "Storgata 12", "Kirkeveien 4B": a street word followed by a house number.
const ADDRESS = /\b[A-ZÆØÅ]?[a-zæøå]+(?:gata|gate|veien|vegen|vei|veg|bakken|stien|svingen|plassen|alléen|tunet|lia|haugen|grenda)\s+\d{1,4}\s?[a-zA-Z]?\b/i;

export type ShareWarning = 'ADDRESS' | 'PHONE';

/** What the person is about to share too early (rule 6). Shown under the text field while typing. */
export function shareWarning(draft: string, hasAgreement: boolean): ShareWarning | null {
  if (hasAgreement || !draft.trim()) return null;
  if (ADDRESS.test(draft)) return 'ADDRESS';
  if (splitMessage(draft).some((p) => p.kind === 'phone')) return 'PHONE';
  return null;
}
