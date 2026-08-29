/**
 * Seeds demo users + listings + a couple of conversations into the live project.
 * Run:  npm run seed:demo        (needs SUPABASE_SERVICE_ROLE_KEY in .env)
 *
 * Idempotent: demo users are created once (by email), rows are upserted on
 * stable ids. Safe to re-run.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = 'minnabo-demo';

const DEMO = [
  { email: 'me@minnabo.test', name: 'Marius B.', place: 'Lillehammer' },
  { email: 'emma@minnabo.test', name: 'Emma Larsen', place: 'Lillehammer' },
  { email: 'martin@minnabo.test', name: 'Martin Ruud', place: 'Hamar' },
  { email: 'sara@minnabo.test', name: 'Sara Ahmed', place: 'Gjøvik' },
  { email: 'andreas@minnabo.test', name: 'Andreas Berg', place: 'Lillehammer' },
  { email: 'fjellbygg@minnabo.test', name: 'Fjellbygg AS', place: 'Øyer' },
] as const;

async function ensureUser(email: string, name: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (created?.user) return created.user.id;
  if (error && !/already been registered|already exists/i.test(error.message)) throw error;

  // find the existing user
  let page = 1;
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
    page++;
  }
  throw new Error(`Could not find or create ${email}`);
}

async function main() {
  const ids: Record<string, string> = {};
  for (const d of DEMO) {
    const id = await ensureUser(d.email, d.name);
    ids[d.email] = id;
    await admin
      .from('profiles')
      .update({
        display_name: d.name,
        place: d.place,
        municipality: d.place,
        is_business: d.email === 'fjellbygg@minnabo.test',
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  const listing = (
    overrides: Record<string, unknown>,
  ): Record<string, unknown> => ({
    price_currency: 'NOK',
    municipality: 'Lillehammer',
    place: 'Lillehammer',
    ...overrides,
  });

  // A small, deterministic set. Uses fixed UUIDs so re-runs upsert.
  const L = {
    plen: 'd0000000-0000-0000-0000-000000000001',
    gjerde: 'd0000000-0000-0000-0000-000000000002',
    flytting: 'd0000000-0000-0000-0000-000000000003',
    hage: 'd0000000-0000-0000-0000-000000000004',
    montering: 'd0000000-0000-0000-0000-000000000005',
    maling: 'd0000000-0000-0000-0000-000000000006',
  };

  await admin.from('listings').upsert([
    listing({ id: L.plen, type: 'TASK_REQUEST', owner_id: ids['emma@minnabo.test'], title: 'Klippe plen', category_slug: 'hage', price_amount_minor: 50000, price_mode: 'BUDGET', status: 'RECEIVING_OFFERS' }),
    listing({ id: L.gjerde, type: 'TASK_REQUEST', owner_id: ids['me@minnabo.test'], title: 'Male gjerdet', category_slug: 'maling', price_amount_minor: 250000, price_mode: 'BUDGET', status: 'RECEIVING_OFFERS' }),
    listing({ id: L.flytting, type: 'TASK_REQUEST', owner_id: ids['martin@minnabo.test'], title: 'Hjelp til flytting', category_slug: 'flytting', price_amount_minor: 150000, price_mode: 'BUDGET', place: 'Hamar', municipality: 'Hamar', status: 'PUBLISHED' }),
    listing({ id: L.hage, type: 'SERVICE_OFFER', owner_id: ids['andreas@minnabo.test'], title: 'Jeg kan klippe plenen din', category_slug: 'hage', price_amount_minor: 40000, price_mode: 'FROM', status: 'ACTIVE' }),
    listing({ id: L.montering, type: 'SERVICE_OFFER', owner_id: ids['sara@minnabo.test'], title: 'Montering av møbler', category_slug: 'montering', price_amount_minor: 60000, price_mode: 'FROM', place: 'Gjøvik', municipality: 'Gjøvik', status: 'ACTIVE' }),
    listing({ id: L.maling, type: 'SERVICE_OFFER', owner_id: ids['fjellbygg@minnabo.test'], title: 'Maling og vedlikehold', category_slug: 'maling', price_amount_minor: null, price_mode: 'BY_AGREEMENT', place: 'Øyer', municipality: 'Øyer', status: 'ACTIVE' }),
  ]);

  await admin.from('task_details').upsert([
    { listing_id: L.plen, description: 'Stor hage, tar ca. en time. Gressklipper kan lånes.' },
    { listing_id: L.gjerde, description: 'Ca. 20 meter gjerde som trenger to strøk.' },
    { listing_id: L.flytting, description: 'To personer, flyttebil er ordnet.' },
  ]);
  await admin.from('service_offer_details').upsert([
    { listing_id: L.hage, about: 'Rask og nøyaktig. Har eget utstyr.', services: ['Plenklipping', 'Kantklipping'], experience_years: 3 },
    { listing_id: L.montering, about: 'Monterer det meste fra flatpakke.', services: ['Møbelmontering'], experience_years: 5 },
    { listing_id: L.maling, about: 'Registrert bedrift, forsikret.', services: ['Maling', 'Vedlikehold'], experience_years: 12 },
  ]);

  // One live conversation: Andreas gives Emma a proposal on "Klippe plen".
  const { data: conv } = await admin
    .from('conversations')
    .upsert({ id: 'd1000000-0000-0000-0000-000000000001', listing_id: L.plen })
    .select('id')
    .single();
  const convId = (conv as { id: string }).id;
  await admin.from('conversation_participants').upsert([
    { conversation_id: convId, profile_id: ids['emma@minnabo.test'] },
    { conversation_id: convId, profile_id: ids['andreas@minnabo.test'] },
  ]);
  await admin.from('proposals').upsert({
    id: 'd2000000-0000-0000-0000-000000000001',
    listing_id: L.plen,
    conversation_id: convId,
    from_profile_id: ids['andreas@minnabo.test'],
    to_profile_id: ids['emma@minnabo.test'],
    price_amount_minor: 45000,
    message: 'Hei! Jeg kan ta det på lørdag.',
    scheduled_text: 'Lørdag 10:00',
    status: 'SENT',
    client_token: 'demo-seed-1',
  });
  await admin.from('messages').upsert([
    { id: 'd3000000-0000-0000-0000-000000000001', conversation_id: convId, author_id: ids['andreas@minnabo.test'], kind: 'TEXT', text: 'Hei! Jeg kan klippe plenen i helga.', client_token: 'demo-m1' },
    { id: 'd3000000-0000-0000-0000-000000000002', conversation_id: convId, author_id: ids['andreas@minnabo.test'], kind: 'PROPOSAL', proposal_id: 'd2000000-0000-0000-0000-000000000001', text: '', client_token: 'demo-m2' },
  ]);

  console.log('Seed complete. Demo logins (password: minnabo-demo):');
  for (const d of DEMO) console.log(`  ${d.email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
