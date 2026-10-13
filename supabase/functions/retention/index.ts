// Supabase Edge Function: the part of the nightly clean-up that SQL cannot do.
// Called by `retention_tick()` (0064) after the database part has run:
//  1. removes the files in `storage_purge_queue` (photos of deleted accounts, old
//     chat photos, old oppdrag photos, old report screenshots)
//  2. closes the login of accounts that were deleted for inactivity (soft delete, same
//     as `delete-account`, so the «Slettet bruker» row stays for the other party)
// Only callable with the shared secret – the same one `send-push` uses.
//
// Deploy: npx supabase functions deploy retention --no-verify-jwt
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BATCH = 500;

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'Ikke tilgang.' }, 401);

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- 1. files ----------------------------------------------------------
    const { data: rows, error } = await admin.from('storage_purge_queue').select('id, bucket, path').order('id').limit(BATCH);
    if (error) return json({ error: error.message }, 500);

    const byBucket = new Map<string, { id: number; path: string }[]>();
    for (const r of rows ?? []) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), { id: r.id, path: r.path }]);

    let files = 0;
    const failed: string[] = [];
    for (const [bucket, items] of byBucket) {
      // a file that is already gone is not an error: remove() just leaves it out
      const { error: rmErr } = await admin.storage.from(bucket).remove(items.map((i) => i.path));
      if (rmErr) {
        failed.push(`${bucket}: ${rmErr.message}`);
        continue; // stays queued for the next night
      }
      await admin.from('storage_purge_queue').delete().in('id', items.map((i) => i.id));
      files += items.length;
    }

    // --- 2. logins of accounts deleted for inactivity -----------------------
    let logins = 0;
    const { data: ids } = await admin.rpc('accounts_awaiting_auth_delete');
    for (const id of (ids as string[] | null) ?? []) {
      const { error: delErr } = await admin.auth.admin.deleteUser(id, true);
      if (delErr) failed.push(`user ${id}: ${delErr.message}`);
      else logins++;
    }

    if (failed.length) console.error('retention', failed);
    return json({ files, logins, failed: failed.length }, 200);
  } catch (e) {
    console.error('retention', e);
    return json({ error: (e as any)?.message ?? 'Ukjent feil.' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
