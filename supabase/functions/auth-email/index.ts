// Supabase "Send Email" auth hook — DEV / TEST ONLY.
//
// When registered (Dashboard → Authentication → Hooks → Send Email Hook), this
// REPLACES Supabase's outgoing auth emails. Instead of sending anything, it
// stores the one-time code in `dev_otp_codes` so the login screen can show it.
//
// DO NOT register this hook on a production project.
//
// Deploy:  npx supabase functions deploy auth-email --no-verify-jwt
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const email: string | undefined = payload?.user?.email;
    const token: string | undefined = payload?.email_data?.token;

    if (email && token) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      await admin.rpc('set_dev_otp', { p_email: email, p_code: token });
    }

    // 200 with empty body = "handled, don't send an email".
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message ?? 'error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
