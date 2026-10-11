import { supabase } from '@/lib/supabase';
import { SupabaseApiClient } from '@/api/supabaseClient';

/** A query builder that records its calls and resolves to `result`. */
function builder(result: { data: unknown; error: null | { message: string } }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'textSearch']) {
    b[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return b;
    };
  }
  b.then = (resolve: (v: unknown) => void) => resolve(result);
  return { b, calls };
}

const ME = 'u-mb';
const msg = (id: string, path: string) => ({
  id,
  conversation_id: 'c1',
  author_id: 'u-emma',
  kind: 'IMAGE',
  text: '',
  attachment_path: path,
  created_at: '2026-10-10T10:00:00Z',
});

let tables: Record<string, ReturnType<typeof builder>[]>;
let signer: jest.Mock;

beforeEach(() => {
  tables = {};
  (supabase.from as jest.Mock).mockImplementation((t: string) => {
    const next = tables[t]?.shift();
    return (next ?? builder({ data: [], error: null })).b;
  });
  signer = jest.fn(async (paths: string[]) => ({
    data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}?token=1`, error: null })),
    error: null,
  }));
  (supabase as unknown as { storage: unknown }).storage = { from: jest.fn(() => ({ createSignedUrls: signer })) };
});

test('chat photos come back as signed links (old public links are converted), and are cached', async () => {
  const api = new SupabaseApiClient();
  tables.messages = [
    builder({ data: [msg('m1', 'u-emma/a.jpg'), msg('m2', 'https://x.supabase.co/storage/v1/object/public/chat-attachments/u-emma/b.jpg')], error: null }),
    builder({ data: [msg('m1', 'u-emma/a.jpg')], error: null }),
  ];
  const first = await api.listMessages('c1');
  expect(first.map((m) => m.attachmentUrl)).toEqual(['https://signed/u-emma/a.jpg?token=1', 'https://signed/u-emma/b.jpg?token=1']);
  expect(signer).toHaveBeenCalledWith(['u-emma/a.jpg', 'u-emma/b.jpg'], expect.any(Number));

  // the same photo again: no new signing request
  const again = await api.listMessages('c1');
  expect(again[0].attachmentUrl).toBe('https://signed/u-emma/a.jpg?token=1');
  expect(signer).toHaveBeenCalledTimes(1);
});

test('a chat photo is sent as a path, even when an old build passes the full link', async () => {
  const api = new SupabaseApiClient();
  const insert = builder({ data: msg('m3', 'u-mb/c.jpg'), error: null });
  tables.messages = [insert];
  const sent = await api.sendAttachment('c1', 'https://x.supabase.co/storage/v1/object/public/chat-attachments/u-mb/c.jpg');
  const row = insert.calls.find((c) => c.method === 'insert')!.args[0] as { attachment_path: string };
  expect(row.attachment_path).toBe('u-mb/c.jpg');
  expect(sent.attachmentUrl).toBe('https://signed/u-mb/c.jpg?token=1');
});

test('own home notes are read from and saved to profile_home_notes – never the public profile row', async () => {
  const api = new SupabaseApiClient();
  const profileRow = { id: ME, display_name: 'Marius B.', initials: 'MB', member_since: '2026', is_business: false, role: 'user', home_notes: 'LEKK', phone: '999' };
  tables.profiles = [builder({ data: profileRow, error: null })];
  tables.profile_home_notes = [builder({ data: { notes: 'Porten er på baksiden' }, error: null })];
  const me = await api.getProfile(ME);
  expect(me.homeNotes).toBe('Porten er på baksiden');
  expect(me.phone).toBeUndefined();

  // someone else's profile: no notes lookup at all
  tables.profiles = [builder({ data: { ...profileRow, id: 'u-emma' }, error: null })];
  const other = await api.getProfile('u-emma');
  expect(other.homeNotes).toBeUndefined();

  // saving notes only → upsert into profile_home_notes, the profiles row is not touched
  const upsert = builder({ data: null, error: null });
  tables.profile_home_notes = [upsert, builder({ data: { notes: 'Ny tekst' }, error: null })];
  tables.profiles = [builder({ data: profileRow, error: null })];
  const saved = await api.updateProfile({ homeNotes: ' Ny tekst ' });
  expect(upsert.calls.find((c) => c.method === 'upsert')!.args[0]).toMatchObject({ profile_id: ME, notes: 'Ny tekst' });
  expect((supabase.from as jest.Mock).mock.calls.filter((c) => c[0] === 'profiles').length).toBeGreaterThan(0);
  expect(saved.homeNotes).toBe('Ny tekst');
});
