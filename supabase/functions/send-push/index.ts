// Supabase Edge Function: send a push notification through Expo.
// Called by database triggers (0039_push.sql) for every new notification row and
// every new chat message – never by the app. The caller proves itself with the
// shared PUSH_SECRET header.
//
// Applies the recipient's Varslinger settings before sending:
//   master switch · push channel · per-type switch · quiet hours · muted chat (for good or until a time)
// Safety / moderation messages ignore the master switch and quiet hours.
// During quiet hours a push is held (held_pushes, 0109) and sent when they end; the database asks for that
// every 10 minutes with `type: 'held'`. Several messages from one person come as «Kari sendte 4 meldinger».
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
  JOB_DAY: 'time',
  NO_SHOW: 'decided',
};

// Same defaults as DEFAULT_NOTIFICATION_PREFS in src/api/ApiClient.ts.
const DEFAULT_PUSH: Record<Key, boolean> = {
  msg: true, offer: true, changed: true, decided: true, time: true,
  done: true, review: true, match: true, board: true, mod: true,
};

type Push = { profileId: string; key: Key; title: string; body: string; route: string | null; conversationId?: string };

/**
 * A push that opens a review gets star buttons («★★★★★», «★★★★», «Skriv vurdering»).
 * The app registers the buttons under this name: REVIEW_CATEGORY in src/components/PushBridge.tsx.
 */
const REVIEW_CATEGORY = 'review';
// One-tap answers (0074), registered in the app's PushBridge.tsx with the same names:
// «Jeg kommer» on «Bekreft at du kommer», «Ja, jeg kan i dag» on «Oppdraget er ledig igjen».
const ATTEND_CATEGORY = 'attend';
const AVAILABLE_CATEGORY = 'available';
// «Svar» straight from a chat push (2026-11-09): a text field in the notification, MESSAGE_CATEGORY in PushBridge.tsx
const MESSAGE_CATEGORY = 'message';
const categoryFor = (route?: string | null) =>
  !route ? undefined
    : route.startsWith('/chat/') ? MESSAGE_CATEGORY
    : route.startsWith('/vurder/') ? REVIEW_CATEGORY
    : route.includes('?bekreft=1') ? ATTEND_CATEGORY
    : route.includes('?ledig=1') ? AVAILABLE_CATEGORY
    : undefined;

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

    if (type === 'held') return json({ sent: await releaseHeld(db) });
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
  const { data: m } = await db.from('messages').select('conversation_id, author_id, kind, text, attachment_kind').eq('id', id).maybeSingle();
  if (!m) return [];
  const [{ data: author }, { data: others }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', m.author_id).maybeSingle(),
    db.from('conversation_participants').select('profile_id, muted, muted_until, last_read_at').eq('conversation_id', m.conversation_id).neq('profile_id', m.author_id),
  ]);
  const body =
    m.kind === 'IMAGE' ? '📷 Bilde'
    : m.kind === 'AUDIO' ? '🎤 Talemelding'
    : m.attachment_kind === 'VIDEO' ? '🎬 Video'
    : m.attachment_kind === 'FILE' ? '📄 PDF'
    : String(m.text ?? '').slice(0, 140);
  const now = Date.now();
  const name = author?.display_name ?? 'Ny melding';
  const out: Push[] = [];
  for (const o of others ?? []) {
    if (o.muted || (o.muted_until && Date.parse(o.muted_until) > now)) continue;
    // «Kari sendte 4 meldinger»: how many from this person the recipient hasn't read yet
    const { count } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', m.conversation_id)
      .eq('author_id', m.author_id)
      .gt('created_at', o.last_read_at ?? '1970-01-01');
    out.push({
      profileId: o.profile_id,
      key: 'msg' as Key,
      title: (count ?? 0) > 1 ? `${name.split(' ')[0]} sendte ${count} meldinger` : name,
      body,
      route: `/chat/${m.conversation_id}`,
      conversationId: m.conversation_id,
    });
  }
  return out;
}

/** Quiet hours are over for these people: one push each with what was held (or the single one as it was). */
async function releaseHeld(db: any): Promise<number> {
  const { data: rows } = await db.from('held_pushes').select('*').order('created_at').limit(500);
  if (!rows?.length) return 0;
  const byProfile = new Map<string, any[]>();
  for (const r of rows) byProfile.set(r.profile_id, [...(byProfile.get(r.profile_id) ?? []), r]);
  let sent = 0;
  for (const [profileId, list] of byProfile) {
    const { data: settings } = await db.from('profile_settings').select('notification_prefs').eq('profile_id', profileId).maybeSingle();
    const quiet = { on: false, from: '22:00', to: '07:00', ...((settings?.notification_prefs ?? {}).quiet ?? {}) };
    if (quiet.on && inQuietHours(quiet.from, quiet.to)) continue;
    const one = list.length === 1 ? list[0] : null;
    sent += await deliver(
      db,
      one
        ? { profileId, key: 'msg', title: one.title, body: one.body, route: one.route, conversationId: one.conversation_id ?? undefined }
        : { profileId, key: 'msg', title: `${list.length} varsler mens det var stille`, body: list.slice(-3).map((r: any) => r.title).join(' · '), route: '/innboks' },
      true,
    );
    await db.from('held_pushes').delete().in('id', list.map((r: any) => r.id));
  }
  return sent;
}

async function deliver(db: any, p: Push, released = false): Promise<number> {
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
    const quiet = { on: false, from: '22:00', to: '07:00', ...(prefs.quiet ?? {}) };
    if (!released && quiet.on && inQuietHours(quiet.from, quiet.to)) {
      // held, not dropped: it comes when the quiet hours end
      await db.from('held_pushes').insert({ profile_id: p.profileId, title: p.title, body: p.body, route: p.route, conversation_id: p.conversationId ?? null });
      return 0;
    }
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
        // MinNabo's own sound (bundled in the app, assets/sounds). iPhone vibrates for it on
        // silent; Android takes sound + vibration from the channel (src/lib/notifications.ts).
        sound: 'minnabo.wav',
        channelId: 'minnabo',
        priority: 'high',
        ...(typeof badge === 'number' ? { badge } : {}),
        // the conversation goes along, so «Svar» in the notification knows where to send
        data: { route: p.route, ...(p.conversationId ? { conversationId: p.conversationId } : {}) },
        ...(categoryFor(p.route) ? { categoryId: categoryFor(p.route) } : {}),
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
