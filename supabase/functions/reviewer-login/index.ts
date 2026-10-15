// Supabase Edge Function: login for Apple's / Google's app reviewer.
//
// The reviewer has no Norwegian phone or BankID and cannot use Vipps, and the store does
// not approve an app it cannot get into. This lets ONE fixed demo account in with a user
// name and a password. It is an ordinary adult account: no admin rights.
//
// { username, password } → { tokenHash, isNew, youth: false }  (same answer as vipps-login)
//
// On / off without a new build:
//   on:   npx supabase secrets set REVIEWER_USERNAME=… REVIEWER_PASSWORD=…
//   off:  npx supabase secrets unset REVIEWER_PASSWORD
// With no password set, the function answers "not available" to everyone.
// Remove for good: npx supabase functions delete reviewer-login  (+ see docs/LEFT_OUT.md A28)
//
// Deploy: npx supabase functions deploy reviewer-login --no-verify-jwt
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** How the demo account is recognised (the place Vipps accounts keep their Vipps id). */
const REVIEWER_SUB = 'reviewer:app-store';
const MIN_PASSWORD = 12;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Bruk POST.' }, 405);

  try {
    const wantUser = Deno.env.get('REVIEWER_USERNAME') ?? '';
    const wantPass = Deno.env.get('REVIEWER_PASSWORD') ?? '';
    // switched off, or a password too short to be safe
    if (!wantUser || wantPass.length < MIN_PASSWORD) return json({ error: 'Ikke tilgjengelig.', code: 'DISABLED' }, 404);

    const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
    const ok = (await same(String(username ?? '').trim().toLowerCase(), wantUser.trim().toLowerCase())) && (await same(String(password ?? ''), wantPass));
    if (!ok) {
      await new Promise((r) => setTimeout(r, 1500)); // slows down guessing
      return json({ error: 'Feil brukernavn eller passord.' }, 401);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- find or create the demo account (same steps as vipps-login) ---------
    let profileId: string | null = null;
    let isNew = false;
    const { data: known } = await admin.from('profile_private').select('profile_id').eq('vipps_sub', REVIEWER_SUB).maybeSingle();
    if (known) {
      const { data: prof } = await admin.from('profiles').select('id, suspended_at, deleted_at').eq('id', known.profile_id).maybeSingle();
      if (prof?.suspended_at) return json({ error: 'Kontoen er suspendert.', code: 'SUSPENDED' }, 403);
      if (prof && !prof.deleted_at) profileId = prof.id;
      // the reviewer tried «Slett konto»: start over with a fresh account
      else await admin.from('profile_private').delete().eq('profile_id', known.profile_id);
    }

    let email: string;
    if (profileId) {
      const { data: u, error } = await admin.auth.admin.getUserById(profileId);
      if (error || !u.user?.email) return json({ error: 'Fant ikke kontoen.' }, 500);
      email = u.user.email;
    } else {
      isNew = true;
      // internal address, never shown or mailed (the sign-up trigger skips this domain)
      email = `${crypto.randomUUID()}@vipps.minnabo.invalid`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: 'Test T.' },
        app_metadata: { provider: 'reviewer' },
      });
      if (error || !created.user) return json({ error: error?.message ?? 'Kunne ikke opprette konto.' }, 500);
      profileId = created.user.id;
      const { error: ppErr } = await admin.from('profile_private').upsert({
        profile_id: profileId,
        vipps_sub: REVIEWER_SUB,
        full_name: 'Test Testesen',
        phone: null,
        email: null,
        birth_date: '1990-01-01',
        updated_at: new Date().toISOString(),
      });
      if (ppErr) return json({ error: ppErr.message }, 500);
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = (link as any)?.properties?.hashed_token as string | undefined;
    if (linkErr || !tokenHash) return json({ error: linkErr?.message ?? 'Kunne ikke starte økten.' }, 500);

    console.log('reviewer-login ok', isNew ? '(new account)' : '');
    return json({ tokenHash, isNew, youth: false }, 200);
  } catch (e) {
    console.error('reviewer-login', e);
    return json({ error: (e as any)?.message ?? 'Ukjent feil.' }, 500);
  }
});

/** Compares two strings without leaking, through timing, how much of them matched. */
async function same(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const p = new Uint8Array(x);
  const q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
