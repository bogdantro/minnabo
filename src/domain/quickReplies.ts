import type { AgreementSnapshot } from './types';
import { formatTime } from '@/lib/datetime';

export type ReplyStage = 'before' | 'agreed' | 'jobDay' | 'after';

/** After the agreed time plus this, the job is treated as done and the replies say thanks. */
const AFTER_JOB_MS = 6 * 60 * 60 * 1000; // 6 hours

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Where the conversation is: no avtale yet → «before»; on the day → «jobDay»; 6 h after → «after». */
export function replyStage(agreement: AgreementSnapshot | null | undefined, jobDone: boolean, now: Date): ReplyStage {
  if (jobDone) return 'after';
  if (!agreement || agreement.cancelledAt) return 'before';
  if (!agreement.scheduledAt) return 'agreed';
  const at = new Date(agreement.scheduledAt);
  if (now.getTime() > at.getTime() + AFTER_JOB_MS) return 'after';
  return sameDay(at, now) ? 'jobDay' : 'agreed';
}

/**
 * Hurtigsvar fitted to the conversation: the helper on the job day gets «Er på vei!», the owner
 * after the job gets «Takk for jobben!». `scheduledAt` gives «Passer det fortsatt kl. 14:00?».
 */
export function quickReplies(stage: ReplyStage, iAmHelper: boolean, scheduledAt?: string): string[] {
  const t = scheduledAt ? formatTime(scheduledAt) : null;
  const stillOk = t ? `Passer det fortsatt kl. ${t}?` : 'Passer tidspunktet fortsatt?';
  const replies: Record<ReplyStage, [string[], string[]]> = {
    // [owner, helper]
    before: [
      ['Takk! Når kan du?', 'Har du gjort dette før?', 'Hva tar du med av utstyr?'],
      ['Hei! Jeg kan hjelpe deg med dette.', 'Når passer det for deg?', 'Har du et bilde av jobben?'],
    ],
    agreed: [
      [stillOk, 'Ring på når du kommer.', 'Takk, vi ses!'],
      [stillOk, 'Hvor kan jeg parkere?', 'Gleder meg, vi ses!'],
    ],
    jobDay: [
      ['Døra er åpen.', 'Ser deg snart!', 'Ring meg når du er her.'],
      ['Er på vei!', 'Er der om 10 min.', 'Står utenfor nå.'],
    ],
    after: [
      ['Takk for jobben!', 'Kjempebra gjort!', 'Takk for hjelpen!'],
      ['Takk for oppdraget!', 'Hyggelig å hjelpe!', 'Si fra om noe ikke ble bra.'],
    ],
  };
  return replies[stage][iAmHelper ? 1 : 0];
}
