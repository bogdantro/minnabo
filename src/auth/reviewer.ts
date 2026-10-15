import { supabase } from '@/lib/supabase';

/**
 * Login for the app stores' reviewer, who cannot use Vipps (no Norwegian phone / BankID).
 * The `reviewer-login` edge function lets one fixed demo account in with a user name and
 * a password, and answers "not available" when no password is set on the server – so it is
 * switched on and off there, without a new build. Everyone else logs in with Vipps.
 *
 * To remove it for good: delete this file, `components/ReviewerLogin.tsx`, the flag
 * `reviewerLogin` and the edge function (docs/LEFT_OUT.md A28).
 */
export async function reviewerLogin(username: string, password: string): Promise<{ isNew: boolean }> {
  const { data, error } = await supabase.functions.invoke('reviewer-login', { body: { username, password } });
  if (error || !data?.tokenHash) {
    // The function answers with { error } in norsk; functions-js hides it behind a generic message.
    let message: string | undefined = data?.error;
    const res = (error as { context?: Response } | null)?.context;
    if (!message && res && typeof res.json === 'function') {
      message = await res
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
    }
    throw new Error(message || 'Kunne ikke logge inn. Prøv igjen.');
  }
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'magiclink' });
  if (otpError) throw new Error('Kunne ikke starte økten. Prøv igjen.');
  return { isNew: !!data.isNew };
}
