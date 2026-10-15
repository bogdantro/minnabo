// Supabase Edge Function: log in with Vipps (OIDC authorization-code flow).
//
// "Simple login from a mobile app" (requested_flow=app_to_app_v2 + PKCE), see
// developer.vippsmobilepay.com/docs/APIs/login-api/api-guide/mobile-app-flows/simple-login/
//
// { action: 'start', redirectUri } → { url, state, codeVerifier }
//   Builds the authorize URL. The app keeps state + codeVerifier and opens the URL.
// { code, codeVerifier, redirectUri } (after Vipps sent the person back to the app)
//   1. exchanges the code with Vipps (client secret stays on the server),
//   2. reads who the person is (sub, name, phone, birth date),
//   3. finds or creates the Supabase user for that Vipps identity,
//   4. stores the confirmed details in profile_private (0038) – the birth date
//      there decides whether the account is a youth account,
//   5. returns a one-time token the app turns into a normal Supabase session.
// Vipps is used for login only – never for payment.
//
// Secrets (npx supabase secrets set …):
//   VIPPS_CLIENT_ID, VIPPS_CLIENT_SECRET          – from portal.vippsmobilepay.com
//   VIPPS_SUBSCRIPTION_KEY  Ocp-Apim-Subscription-Key of the sales unit (needed for userinfo)
//   VIPPS_MSN            Merchant-Serial-Number of the sales unit
//   VIPPS_BASE_URL       optional, default https://api.vipps.no (test: https://apitest.vipps.no)
//   VIPPS_REDIRECT_URIS  optional, comma-separated allow-list (default: minnabo://vipps/callback)
//   MIN_AGE              optional, default 15 (the terms' minimum age)
//
// Deploy: npx supabase functions deploy vipps-login --no-verify-jwt
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCOPE = 'openid name phoneNumber birthDate email';

type VippsUser = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  phone_number?: string;
  birthdate?: string;
  email?: string;
  email_verified?: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Bruk POST.' }, 405);

  try {
    const { action, code, codeVerifier, redirectUri, trace } = (await req.json().catch(() => ({}))) as {
      action?: 'start';
      code?: string;
      codeVerifier?: string;
      redirectUri?: string;
      /** the app's steps so far: names + milliseconds, no personal data */
      trace?: unknown;
    };
    if (Array.isArray(trace)) {
      const steps = trace
        .slice(0, 40)
        .map((t) => (t && typeof t === 'object' ? `${String((t as any).s).slice(0, 40)}@${Number((t as any).ms) | 0}` : ''))
        .filter(Boolean);
      console.log('vipps-login app steps', steps.join(' '));
    }

    const clientId = Deno.env.get('VIPPS_CLIENT_ID');
    const clientSecret = Deno.env.get('VIPPS_CLIENT_SECRET');
    if (!clientId || !clientSecret) return json({ error: 'Vipps-innlogging er ikke satt opp.' }, 503);

    const allowed = (Deno.env.get('VIPPS_REDIRECT_URIS') ?? 'minnabo://vipps/callback').split(',').map((s) => s.trim());
    if (!redirectUri || !allowed.includes(redirectUri)) return json({ error: 'Ukjent returadresse.' }, 400);

    const base = (Deno.env.get('VIPPS_BASE_URL') ?? 'https://api.vipps.no').replace(/\/$/, '');
    const msn = Deno.env.get('VIPPS_MSN');
    const subKey = Deno.env.get('VIPPS_SUBSCRIPTION_KEY');
    const extra: Record<string, string> = {
      'Vipps-System-Name': 'minnabo',
      'Vipps-System-Version': '1.0.0',
      'Vipps-System-Plugin-Name': 'minnabo-app',
      'Vipps-System-Plugin-Version': '1.0.0',
      ...(msn ? { 'Merchant-Serial-Number': msn } : {}),
      ...(subKey ? { 'Ocp-Apim-Subscription-Key': subKey } : {}),
    };
    const conf = await fetch(`${base}/access-management-1.0/access/.well-known/openid-configuration`, { headers: extra }).then(
      (r) => r.json(),
    );

    // --- 0. start: authorize URL with PKCE ----------------------------------
    if (action === 'start') {
      const state = randomToken(24);
      const verifier = randomToken(48);
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const q = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: SCOPE,
        state,
        nonce: randomToken(16),
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        requested_flow: 'app_to_app_v2',
      });
      return json({ url: `${conf.authorization_endpoint}?${q.toString()}`, state, codeVerifier: verifier }, 200);
    }

    if (!code || !codeVerifier) return json({ error: 'Mangler kode fra Vipps.' }, 400);

    // --- 1. code → access token -------------------------------------------
    const tokenRes = await fetch(conf.token_endpoint, {
      method: 'POST',
      headers: {
        ...extra,
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
    });
    if (!tokenRes.ok) {
      console.error('vipps token', tokenRes.status, await tokenRes.text());
      return json({ error: 'Vipps godtok ikke innloggingen. Prøv igjen.' }, 401);
    }
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // --- 2. who is it? ------------------------------------------------------
    const infoRes = await fetch(conf.userinfo_endpoint, { headers: { ...extra, Authorization: `Bearer ${access_token}` } });
    if (!infoRes.ok) {
      console.error('vipps userinfo', infoRes.status, await infoRes.text());
      return json({ error: 'Kunne ikke hente opplysninger fra Vipps.' }, 502);
    }
    const v = (await infoRes.json()) as VippsUser;
    // claim names only (no personal data) – shows which scopes the sales unit's plan delivers
    console.log('vipps userinfo claims', Object.keys(v).sort().join(','));
    if (!v.sub) return json({ error: 'Vipps ga ingen identitet.' }, 502);
    if (!v.birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(v.birthdate)) {
      return json({ error: 'Vi trenger fødselsdatoen din fra Vipps for å bekrefte alderen.' }, 400);
    }
    const age = ageOn(v.birthdate, new Date());
    const minAge = Number(Deno.env.get('MIN_AGE') ?? '15');
    if (age < minAge) return json({ error: `Du må være minst ${minAge} år for å bruke MinNabo.`, code: 'TOO_YOUNG' }, 403);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- 3. find or create the user ---------------------------------------
    let profileId: string | null = null;
    let isNew = false;
    const { data: known } = await admin.from('profile_private').select('profile_id').eq('vipps_sub', v.sub).maybeSingle();
    if (known) {
      const { data: prof } = await admin
        .from('profiles')
        .select('id, suspended_at, deleted_at')
        .eq('id', known.profile_id)
        .maybeSingle();
      if (prof?.suspended_at) return json({ error: 'Kontoen din er suspendert. Kontakt MinNabo.', code: 'SUSPENDED' }, 403);
      if (prof && !prof.deleted_at) profileId = prof.id;
      // a deleted account is gone for good: the same person starts over with a new one
      else await admin.from('profile_private').delete().eq('profile_id', known.profile_id);
    }

    const fullName = v.name ?? [v.given_name, v.family_name].filter(Boolean).join(' ');
    let email: string;
    if (profileId) {
      const { data: u, error } = await admin.auth.admin.getUserById(profileId);
      if (error || !u.user?.email) return json({ error: 'Fant ikke kontoen din. Kontakt MinNabo.' }, 500);
      email = u.user.email;
    } else {
      // The website's admin can close sign-ups (app_settings platform.registration_open = false).
      // People who already have an account were handled above and still get in.
      const { data: reg } = await admin.from('app_settings').select('value').eq('key', 'platform.registration_open').maybeSingle();
      if (reg?.value === false) {
        return json({ error: 'MinNabo tar ikke imot nye brukere akkurat nå.', code: 'REGISTRATION_CLOSED' }, 403);
      }
      isNew = true;
      // Internal address, never shown or mailed – the login key is the Vipps sub.
      email = `${crypto.randomUUID()}@vipps.minnabo.invalid`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: displayName(v, fullName) },
        app_metadata: { provider: 'vipps' },
      });
      if (error || !created.user) return json({ error: error?.message ?? 'Kunne ikke opprette konto.' }, 500);
      profileId = created.user.id;
    }

    // --- 4. confirmed details + verifications -----------------------------
    const { error: ppErr } = await admin.from('profile_private').upsert({
      profile_id: profileId,
      vipps_sub: v.sub,
      full_name: fullName || null,
      phone: v.phone_number ?? null,
      email: v.email ?? null,
      birth_date: v.birthdate,
      updated_at: new Date().toISOString(),
    });
    if (ppErr) return json({ error: ppErr.message }, 500);

    const now = new Date().toISOString();
    if (v.phone_number) {
      await admin.from('verifications').upsert({
        profile_id: profileId,
        kind: 'PHONE',
        verified: true,
        explanation: 'Telefonnummeret er hentet fra Vipps da du logget inn.',
        verified_at: now,
      });
    }
    if (v.email && v.email_verified !== false) {
      await admin.from('verifications').upsert({
        profile_id: profileId,
        kind: 'EMAIL',
        verified: true,
        explanation: 'E-postadressen er hentet fra Vipps-profilen din.',
        verified_at: now,
      });
      await admin.from('profile_settings').upsert({ profile_id: profileId, email: v.email }, { onConflict: 'profile_id' });
    } else if (isNew) {
      // the sign-up trigger marks the (internal) address as verified – it is not the person's e-mail
      await admin.from('verifications').delete().eq('profile_id', profileId).eq('kind', 'EMAIL');
    }

    // --- 5. one-time token → session in the app ----------------------------
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = (link as any)?.properties?.hashed_token as string | undefined;
    if (linkErr || !tokenHash) return json({ error: linkErr?.message ?? 'Kunne ikke starte økten.' }, 500);

    return json({ tokenHash, isNew, youth: age < 18 }, 200);
  } catch (e) {
    console.error('vipps-login', e);
    return json({ error: (e as any)?.message ?? 'Ukjent feil.' }, 500);
  }
});

/** "Mari H." – what other people see until the person changes it. */
function displayName(v: VippsUser, fullName: string): string {
  const first = v.given_name ?? fullName.split(' ')[0] ?? '';
  const last = v.family_name ?? fullName.split(' ').slice(-1)[0] ?? '';
  if (!first) return 'Nabo';
  return last && last !== first ? `${first} ${last[0].toUpperCase()}.` : first;
}

function randomToken(bytes: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ageOn(birthdate: string, now: Date): number {
  const [y, m, d] = birthdate.split('-').map(Number);
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age -= 1;
  return age;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
