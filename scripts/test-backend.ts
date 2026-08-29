/**
 * Integration checks against the live Supabase project.
 * Run:  npm run test:backend      (needs a populated .env + `npm run seed:demo`)
 *
 * Signs in as two seeded demo users and asserts the RLS boundaries and the
 * proposal RPC lifecycle. Exits non-zero on any failure. Cleans up rows it
 * created (titles are namespaced with a run id).
 */
import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = must('EXPO_PUBLIC_SUPABASE_URL');
const anon = must('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const service = must('SUPABASE_SERVICE_ROLE_KEY');

function must(k: string): string {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
  return v;
}

const RUN = `test-${Date.now()}`;
let fails = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    fails++;
    console.error(`  ✗ ${name}`, extra ?? '');
  }
}

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: 'minnabo-demo' });
  if (error) {
    console.error(`Cannot sign in as ${email}: ${error.message}. Run: npm run seed:demo`);
    process.exit(1);
  }
  return c;
}

async function main() {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const emma = await signIn('emma@minnabo.test');
  const martin = await signIn('martin@minnabo.test');
  const sara = await signIn('sara@minnabo.test');

  const emmaId = (await emma.auth.getUser()).data.user!.id;
  const martinId = (await martin.auth.getUser()).data.user!.id;

  // 1. Emma creates a TASK_REQUEST listing
  const { data: listing, error: lErr } = await emma
    .from('listings')
    .insert({
      type: 'TASK_REQUEST',
      owner_id: emmaId,
      title: `${RUN} plen`,
      category_slug: 'hage',
      price_amount_minor: 50000,
      price_mode: 'BUDGET',
      municipality: 'Lillehammer',
      place: 'Lillehammer',
      status: 'PUBLISHED',
    })
    .select('id')
    .single();
  check('Emma creates a listing', !lErr && !!listing, lErr?.message);
  const listingId = (listing as { id: string }).id;
  await emma.from('task_details').insert({ listing_id: listingId, description: 'Stor hage' });

  // 2. Martin can read it; Sara cannot update it
  const { data: readByMartin } = await martin.from('listings').select('id').eq('id', listingId).maybeSingle();
  check('Martin can read the listing', !!readByMartin);
  const { data: badUpdate } = await sara.from('listings').update({ title: 'hijack' }).eq('id', listingId).select('id');
  check('Sara cannot update a listing she does not own', !badUpdate || badUpdate.length === 0);

  // 3. Martin starts a conversation + sends a proposal (idempotent on client_token)
  const { data: conv, error: cErr } = await martin.rpc('start_conversation_for_listing', {
    p_listing_id: listingId,
  });
  check('start_conversation_for_listing', !cErr && !!conv, cErr?.message);
  const convId = (conv as { id: string }).id;

  const send = () =>
    martin.rpc('send_proposal', {
      p_conversation_id: convId,
      p_listing_id: listingId,
      p_price_minor: 45000,
      p_message: 'Kan gjøre det lørdag',
      p_scheduled_text: 'Lørdag 10:00',
      p_caveats: '',
      p_client_token: `${RUN}-tok`,
    });
  const { data: p1, error: pErr } = await send();
  check('send_proposal', !pErr && !!p1, pErr?.message);
  const { data: p2 } = await send();
  check('send_proposal is idempotent on client_token', (p1 as { id: string }).id === (p2 as { id: string }).id);
  const proposalId = (p1 as { id: string }).id;

  // 4. Sara (non-participant) cannot read the conversation messages
  const { data: peek } = await sara.from('messages').select('id').eq('conversation_id', convId);
  check('non-participant cannot read messages', !peek || peek.length === 0);

  // 5. Wrong actor is rejected
  const { error: wrongActor } = await martin.rpc('respond_to_proposal', {
    p_proposal_id: proposalId,
    p_event: 'ACCEPT',
    p_actor: 'RECIPIENT',
  });
  check('proposer cannot ACCEPT as RECIPIENT', !!wrongActor, 'expected an error');

  // 6. Emma accepts → agreement snapshot + listing AGREED
  const { error: acceptErr } = await emma.rpc('respond_to_proposal', {
    p_proposal_id: proposalId,
    p_event: 'ACCEPT',
    p_actor: 'RECIPIENT',
  });
  check('Emma accepts the proposal', !acceptErr, acceptErr?.message);
  const { data: agreement } = await emma
    .from('agreement_snapshots')
    .select('proposal_id')
    .eq('proposal_id', proposalId)
    .maybeSingle();
  check('agreement snapshot created on ACCEPT', !!agreement);
  const { data: agreedListing } = await emma.from('listings').select('status').eq('id', listingId).single();
  check('listing status is AGREED', (agreedListing as { status: string }).status === 'AGREED');

  // 7. Review is rejected before completion, accepted after both confirm
  const { error: earlyReview } = await emma.rpc('submit_review', {
    p_agreement_proposal_id: proposalId,
    p_rating: 5,
    p_comment: 'for tidlig',
  });
  check('submit_review rejected before completion', !!earlyReview);

  await emma.rpc('confirm_completion', { p_agreement_proposal_id: proposalId });
  await martin.rpc('confirm_completion', { p_agreement_proposal_id: proposalId });
  const { error: reviewErr } = await emma.rpc('submit_review', {
    p_agreement_proposal_id: proposalId,
    p_rating: 5,
    p_comment: 'Kjempebra',
  });
  check('submit_review accepted after both confirm completion', !reviewErr, reviewErr?.message);

  // cleanup
  await admin.from('listings').delete().eq('id', listingId);

  console.log(fails === 0 ? '\nAll backend checks passed.' : `\n${fails} check(s) failed.`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
