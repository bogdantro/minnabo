import { Platform } from 'react-native';
import { colors } from '@/theme/theme';

/** Text into HTML: everything a person typed goes through this. */
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Rows of «label: value» for a PDF; empty values are left out. */
export function pdfRows(rows: [string, string | null | undefined][]): string {
  return rows
    .filter((r): r is [string, string] => !!r[1] && !!r[1].trim())
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');
}

/** A one-page A4 document in the app's flat look (no gradients, the same ink and lime). */
export function pdfPage(title: string, body: string, extraCss = ''): string {
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: ${colors.ink}; font-size: 12pt; line-height: 1.45; margin: 0; }
  .band { height: 8px; background: ${colors.lime}; border-radius: 4px; margin-bottom: 18px; }
  .brand { font-weight: 800; font-size: 11pt; letter-spacing: .04em; text-transform: uppercase; color: ${colors.mute}; }
  h1 { font-size: 22pt; line-height: 1.15; margin: 6px 0 4px; }
  .meta { color: ${colors.mute}; font-size: 10pt; }
  .parties { display: flex; gap: 12px; margin: 18px 0; }
  .party { flex: 1; border: 1px solid ${colors.hairline}; border-radius: 14px; padding: 12px 14px; }
  .party small { display: block; color: ${colors.mute}; font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; }
  .party b { font-size: 13pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; vertical-align: top; width: 32%; color: ${colors.mute}; font-weight: 600; padding: 9px 10px 9px 0; border-top: 1px solid ${colors.line2}; }
  td { padding: 9px 0; border-top: 1px solid ${colors.line2}; }
  .note { margin-top: 18px; padding: 12px 14px; border-radius: 12px; background: ${colors.bg}; font-size: 10.5pt; }
  .stamp { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: ${colors.ink}; color: ${colors.lime}; font-weight: 700; font-size: 10pt; }
  .stamp.off { background: ${colors.dangerTint}; color: ${colors.danger}; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  li { margin: 3px 0; }
  .foot { margin-top: 26px; color: ${colors.mute}; font-size: 9pt; }
${extraCss}
</style></head><body><div class="band"></div><div class="brand">MinNabo</div>${body}</body></html>`;
}

/**
 * In a browser expo-print ignores the html and prints the page you are on (the app screen). So the document
 * goes into a hidden frame of its own and that frame is printed; «Lagre som PDF» is one of the choices there.
 */
const PRINT_FRAME_MAX_MS = 60_000;

function printInBrowser(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    // the frame goes when printing is over, or after a minute if the browser never says so
    const cleanup = () => frame.remove();
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('no print frame'));
        return;
      }
      win.addEventListener('afterprint', () => setTimeout(cleanup, 500), { once: true });
      setTimeout(cleanup, PRINT_FRAME_MAX_MS);
      win.focus();
      win.print();
      // the button stops spinning once the dialog has opened; some browsers never send «afterprint»
      resolve();
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

/**
 * Make a PDF and hand it to the share sheet (save to Filer, send by e-post …).
 * In a browser it opens the print dialog, where «Lagre som PDF» is one of the choices.
 * The modules are loaded when needed, so a build without them shows the error instead of crashing.
 */
export async function sharePdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    await printInBrowser(html);
    return;
  }
  const Print = await import('expo-print');
  const { uri } = await Print.printToFileAsync({ html });
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
  } else {
    await Print.printAsync({ uri });
  }
}
