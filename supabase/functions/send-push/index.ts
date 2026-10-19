// Supabase Edge Function: send a push notification through Expo.
// Called by database triggers (0039_push.sql) for every new notification row and
// every new chat message – never by the app. The caller proves itself with the
// shared PUSH_SECRET header.
//
// Applies the recipient's Varslinger settings before sending:
//   master switch · push channel · per-type switch · quiet hours · muted chat
// Safety / moderation messages ignore the master switch and quiet hours.
//
// Secrets: PUSH_SECRET (required), EXPO_ACCESS_TOKEN (optional, if push security is on)
// Deploy:  npx supabase functions deploy send-push --no-verify-jwt
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Key = 'msg' | 'offer' | 'changed' | 'decided' | 'time' | 'done' | 'review' | 'match' | 'board' | 'mod';

const KIND_KEY: Record<string, Key> = {
  NEW_MESSAGE: 'msg',
  NEW_OFFER: 'offer',
  OFFER_CHANGED: 'changed',
  OFFER_WITHDRAWN: 'decided',
  OFFER_ACCEPTED: 'decided',
  OFFER_DECLINED: 'decided',
  AGREEMENT_CANCELLED: 'decided',
  AGREED_TIME: 'time',
  COMPLETION_REQUESTED: 'done',
  REVIEW_RECEIVED: 'review',
  NEW_MATCH: 'match',
  NOTICE_REPLY: 'board',
  NABOLAG_POST: 'board',
  MODERATION: 'mod',
};

// Same defaults as DEFAULT_NOTIFICATION_PREFS in src/api/ApiClient.ts.
const DEFAULT_PUSH: Record<Key, boolean> = {
  msg: true, offer: true, changed: true, decided: true, time: true,
  done: true, review: true, match: true, board: false, mod: true,
};

type Push = { profileId: string; key: Key; title: string; body: string; route: string | null; conversationId?: string };

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return new Response('forbidden', { status: 403 });

  try {
    const { type, id } = (await req.json()) as { type?: string; id?: string };
    if (!type || !id) return json({ skipped: 'bad request' });

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const pushes = type === 'message' ? await fromMessage(db, id) : await fromNotification(db, id);
    let sent = 0;
    for (const p of pushes) sent += await deliver(db, p);
    return json({ sent });
  } catch (e) {
    console.error('send-push', e);
    return json({ error: (e as any)?.message ?? 'unknown' }, 500);
  }
});

async function fromNotification(db: any, id: string): Promise<Push[]> {
  const { data: n } = await db.from('notifications').select('profile_id, kind, title, body, route').eq('id', id).maybeSingle();
  if (!n) return [];
  return [{ profileId: n.profile_id, key: KIND_KEY[n.kind] ?? 'mod', title: n.title, body: n.body, route: n.route }];
}

async function fromMessage(db: any, id: string): Promise<Push[]> {
  const { data: m } = await db.from('messages').select('conversation_id, author_id, kind, text').eq('id', id).maybeSingle();
  if (!m) return [];
  const [{ data: author }, { data: others }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', m.author_id).maybeSingle(),
    db.from('conversation_participants').select('profile_id, muted').eq('conversation_id', m.conversation_id).neq('profile_id', m.author_id),
  ]);
  const body = m.kind === 'IMAGE' ? '📷 Bilde' : String(m.text ?? '').slice(0, 140);
  return (others ?? [])
    .filter((o: any) => !o.muted)
    .map((o: any) => ({
      profileId: o.profile_id,
      key: 'msg' as Key,
      title: author?.display_name ?? 'Ny melding',
      body,
      route: `/chat/${m.conversation_id}`,
      conversationId: m.conversation_id,
    }));
}

async function deliver(db: any, p: Push): Promise<number> {
  const [{ data: settings }, { data: tokens }, { data: profile }] = await Promise.all([
    db.from('profile_settings').select('notification_prefs').eq('profile_id', p.profileId).maybeSingle(),
    db.from('push_tokens').select('token').eq('profile_id', p.profileId),
    db.from('profiles').select('deleted_at, suspended_at').eq('id', p.profileId).maybeSingle(),
  ]);
  if (!tokens?.length || !profile || profile.deleted_at) return 0;

  const prefs = (settings?.notification_prefs ?? {}) as any;
  const safety = p.key === 'mod';
  if (!safety) {
    if (prefs.master === false) return 0;
    if (prefs.channels?.push === false) return 0;
    if ((prefs.push?.[p.key] ?? DEFAULT_PUSH[p.key]) === false) return 0;
    const quiet = { on: true, from: '22:00', to: '07:00', ...(prefs.quiet ?? {}) };
    if (quiet.on && inQuietHours(quiet.from, quiet.to)) return 0;
  }

  // the number on the app icon: unread notifications + conversations (0053; absent before it is pushed)
  const { data: badge } = await db.rpc('badge_count', { p_profile: p.profileId });

  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
    },
    body: JSON.stringify(
      tokens.map((t: any) => ({
        to: t.token,
        title: p.title,
        body: p.body,
        sound: 'default',
        ...(typeof badge === 'number' ? { badge } : {}),
        data: { route: p.route },
      })),
    ),
  });
  const out = await res.json().catch(() => null);
  // Tokens Expo no longer knows are removed so they aren't tried again.
  const tickets: any[] = out?.data ?? [];
  const dead = tickets
    .map((t, i) => (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
    .filter(Boolean);
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  return tokens.length - dead.length;
}

/** Is it now between `from` and `to` (HH:MM, Europe/Oslo)? Handles ranges past midnight. */
function inQuietHours(from: string, to: string): boolean {
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const mins = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return (h % 24) * 60 + (m || 0);
  };
  const n = mins(now);
  const a = mins(from);
  const b = mins(to);
  return a <= b ? n >= a && n < b : n >= a || n < b;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
