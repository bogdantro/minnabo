import nb from '@/i18n/nb';
import type { Message } from '@/domain/types';
import { esc, pdfPage } from './pdf';

/**
 * «Last ned samtalen (PDF)» (0109): the text of a conversation for the person's own records. Photos and voice
 * messages are listed, not embedded; deleted messages stay deleted.
 */
export function conversationPdfHtml(input: { name: string; title: string; meId: string; messages: Message[]; made?: Date }): string {
  const t = nb.innboks.chat;
  const line = (m: Message) => {
    if (m.deletedAt) return `<em>${esc(nb.chat.deleted)}</em>`;
    if (m.kind === 'IMAGE') return '📷 Bilde';
    if (m.kind === 'AUDIO') return `🎤 Talemelding${m.transcript ? `: «${esc(m.transcript)}»` : ''}`;
    if (m.kind === 'PROPOSAL') return 'Sendte et tilbud';
    return esc(m.text).replace(/\n/g, '<br>');
  };
  const rows = input.messages
    .map((m) => {
      const who = m.kind === 'SYSTEM' ? 'MinNabo' : m.authorProfileId === input.meId ? 'Du' : input.name.split(' ')[0];
      const when = new Date(m.createdAt).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<tr><th>${esc(who)}<br><span class="when">${esc(when)}</span></th><td>${line(m)}</td></tr>`;
    })
    .join('');
  const made = (input.made ?? new Date()).toLocaleDateString('nb-NO');
  const body = `<h1>${esc(t.exportTitle(input.name, input.title))}</h1>
    <p class="lead">${esc(t.exportIntro)} ${esc(made)}</p>
    <table>${rows}</table>`;
  return pdfPage(t.exportTitle(input.name, input.title), body, '.when{font-weight:400;color:#6B7280;font-size:9pt}.lead{color:#6B7280}th{width:28%;vertical-align:top;text-align:left}');
}
