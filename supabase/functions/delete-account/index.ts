// Supabase Edge Function: close the calling user's account.
// The app first calls the `delete_my_account` RPC (0031), which anonymises the
// profile and removes private data. Here the auth user is SOFT-deleted: the login
// stops working, but the profile row stays so other people's chats keep showing
// «Slettet bruker» instead of losing their messages (a hard delete cascades).
//
// Deploy: npx supabase functions deploy delete-account
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Ikke innlogget.' }, 401, cors);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Ugyldig økt.' }, 401, cors);

    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id, true);
    if (delErr) return json({ error: delErr.message }, 500, cors);

    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: (e as any)?.message ?? 'Ukjent feil.' }, 500, cors);
  }
});

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
