// Supabase Edge Function: a talemelding written out as text («Vis som tekst»).
// Off until MinNabo has chosen a speech service: the app only shows the button when
// platform.transcripts_enabled is true, and this function refuses otherwise.
//
// Any OpenAI-compatible transcription API works. The clip leaves Supabase for that service, so it
// needs a data processing agreement and a line in Personvern before it is switched on.
//
// Secrets: TRANSCRIBE_API_KEY (required)
//          TRANSCRIBE_URL (default https://api.openai.com/v1/audio/transcriptions)
//          TRANSCRIBE_MODEL (default whisper-1)
// Deploy:  npx supabase functions deploy transcribe
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FAILED = 'Fikk ikke laget tekst av talemeldingen. Prøv igjen.';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('TRANSCRIBE_API_KEY');
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Ikke innlogget.' }, 401);

    const { messageId } = (await req.json()) as { messageId?: string };
    if (!messageId) return json({ error: FAILED }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: who } = await admin.auth.getUser(jwt);
    const me = who.user?.id;
    if (!me) return json({ error: 'Ikke innlogget.' }, 401);

    const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'platform.transcripts_enabled').maybeSingle();
    if (setting?.value !== true || !key) return json({ error: FAILED }, 501);

    const { data: m } = await admin
      .from('messages')
      .select('id, conversation_id, kind, attachment_path, transcript, deleted_at')
      .eq('id', messageId)
      .maybeSingle();
    if (!m || m.kind !== 'AUDIO' || m.deleted_at || !m.attachment_path) return json({ error: FAILED }, 404);

    // only the two people in the conversation
    const { data: part } = await admin
      .from('conversation_participants')
      .select('profile_id')
      .eq('conversation_id', m.conversation_id)
      .eq('profile_id', me)
      .maybeSingle();
    if (!part) return json({ error: 'Ikke tilgang.' }, 403);

    // made once, for both of them
    if (m.transcript) return json({ text: m.transcript });

    const { data: file, error: fileErr } = await admin.storage.from('chat-attachments').download(m.attachment_path);
    if (fileErr || !file) throw fileErr ?? new Error('no file');

    const form = new FormData();
    form.append('file', file, 'talemelding.m4a');
    form.append('model', Deno.env.get('TRANSCRIBE_MODEL') ?? 'whisper-1');
    form.append('language', 'no');
    const res = await fetch(Deno.env.get('TRANSCRIBE_URL') ?? 'https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) throw new Error(`transcribe ${res.status}`);
    const text = String(((await res.json()) as any)?.text ?? '').trim();
    if (!text) return json({ error: FAILED }, 422);

    await admin.from('messages').update({ transcript: text }).eq('id', m.id);
    return json({ text });
  } catch (e) {
    // the detail stays in the log: the person only needs to know it can be tried again
    console.error('transcribe', e);
    return json({ error: FAILED }, 500);
  }
});
