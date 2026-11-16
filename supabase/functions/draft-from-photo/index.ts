// Supabase Edge Function: «Skriv oppdraget fra et bilde».
// The person takes a photo of what needs doing; Claude suggests a category, a title and a
// description. It is only a suggestion: the wizard fills its fields and the person edits and posts.
//
// Off until Admin › Innstillinger › «KI-hjelp i appen» (platform.ai_enabled) is on.
// The photo leaves Supabase for Anthropic, so Personvern has its own line about it.
//
// Secrets: ANTHROPIC_API_KEY (required)
// Deploy:  npx supabase functions deploy draft-from-photo
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const FAILED = 'Fikk ikke laget et forslag fra bildet. Skriv det selv, eller prøv igjen.';
// Enough for a busy weekend of posting; stops one account from running up the bill.
const DAILY_LIMIT = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // the API's own limit per image

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Ikke innlogget.' }, 401);

    const { imagePath } = (await req.json()) as { imagePath?: string };
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: who } = await admin.auth.getUser(jwt);
    const me = who.user?.id;
    if (!me) return json({ error: 'Ikke innlogget.' }, 401);
    // only a photo the person uploaded themselves
    if (!imagePath || !imagePath.startsWith(`${me}/`) || imagePath.includes('..')) return json({ error: FAILED }, 400);

    const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'platform.ai_enabled').maybeSingle();
    if (setting?.value !== true || !key) return json({ error: FAILED }, 501);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('profile_id', me).eq('kind', 'PHOTO_DRAFT').gte('created_at', since);
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'Du har brukt bildeforslag mange ganger i dag. Skriv oppdraget selv, eller prøv igjen i morgen.' }, 429);

    const { data: file, error: fileErr } = await admin.storage.from('listing-images').download(imagePath);
    if (fileErr || !file) return json({ error: FAILED }, 404);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: 'Bildet er for stort. Prøv et annet.' }, 413);

    const { data: cats } = await admin.from('categories').select('slug, label');
    const categories = ((cats ?? []) as { slug: string; label: string }[]);
    if (!categories.length) return json({ error: FAILED }, 500);
    const slugs = categories.map((c) => c.slug);

    await admin.from('ai_usage').insert({ profile_id: me, kind: 'PHOTO_DRAFT' });

    const client = new Anthropic({ apiKey: key });
    const params: any = {
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              categorySlug: { type: 'string', enum: slugs },
              title: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['categorySlug', 'title', 'description'],
            additionalProperties: false,
          },
        },
      },
      system:
        'Du hjelper folk å skrive et oppdrag på MinNabo, en norsk app der naboer hjelper hverandre med små jobber. ' +
        'Du får et bilde av det som skal gjøres. Skriv på norsk bokmål, i førsteperson, enkelt og vennlig, slik en nabo ville skrevet. ' +
        'Tittel: 3–8 ord, uten punktum, starter med et verb når det passer (f.eks. «Klippe plenen og rake løv»). ' +
        'Beskrivelse: 2–4 korte setninger om hva som skal gjøres, ut fra det du ser. ' +
        'Ikke finn på pris, tidspunkt, adresse, navn eller ting du ikke ser på bildet. Ikke nevn betaling. ' +
        'Velg den kategorien som passer best: ' + categories.map((c) => `${c.slug} = ${c.label}`).join(', ') + '. ' +
        'Hvis bildet ikke viser noe en nabo kan hjelpe med, bruk kategorien som passer best og skriv en kort, nøytral tittel.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64(bytes) } },
          { type: 'text', text: 'Lag et forslag til oppdraget.' },
        ],
      }],
    };
    const res: any = await client.beta.messages.create(params);
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return json({ error: FAILED }, 422);
    const text = (res.content ?? []).find((b: any) => b.type === 'text')?.text ?? '';
    const d = JSON.parse(text) as { categorySlug: string; title: string; description: string };
    const clean = (s: string, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    const draft = {
      categorySlug: slugs.includes(d.categorySlug) ? d.categorySlug : slugs[0],
      title: clean(d.title, 80),
      description: String(d.description ?? '').trim().slice(0, 1000),
    };
    if (!draft.title) return json({ error: FAILED }, 422);
    return json({ draft });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      console.error('draft-from-photo rate limit', e);
      return json({ error: 'Mange bruker dette akkurat nå. Prøv igjen om litt.' }, 429);
    }
    // the detail stays in the log: the person only needs to know they can write it themselves
    console.error('draft-from-photo', e);
    return json({ error: FAILED }, 500);
  }
});
