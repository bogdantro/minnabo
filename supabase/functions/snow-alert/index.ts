// Supabase Edge Function: «Det er meldt snø i natt».
// Called once a day by pg_cron (call_snow_alert, 0093), never by the app. Reads MET Norway's
// Locationforecast for each launch kommune and calls snow_alert() (0091) where snow is on the way
// tonight. That function sends the varsler and makes sure a kommune hears it once a day.
//
// Secrets: PUSH_SECRET (the same as send-push)
// Deploy:  npx supabase functions deploy snow-alert --no-verify-jwt
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

// MET requires an identifying User-Agent: https://api.met.no/doc/TermsOfService
const USER_AGENT = 'MinNabo/1.0 https://minnaboapp.no';
const FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

/** Same centres as KOMMUNE_CENTRES in src/data/kommuner.ts. */
const KOMMUNER: Record<string, [number, number]> = {
  Lillehammer: [61.115, 10.466],
  Øyer: [61.264, 10.413],
  Gausdal: [61.25, 10.15],
  Ringsaker: [60.881, 10.94],
  Hamar: [60.795, 11.068],
  Gjøvik: [60.795, 10.692],
  'Nordre Land': [60.836, 10.077],
};

/** Less than this is a dusting: nobody needs a shovel. Millimetres of water ≈ centimetres of snow. */
const MIN_SNOW_MM = 2;
/** At or below this (°C) precipitation counts as snow. */
const SNOW_TEMP = 0.5;
const NIGHT_HOURS = 16;

async function snowTonightMm(lat: number, lon: number): Promise<number> {
  const res = await fetch(`${FORECAST}?lat=${lat}&lon=${lon}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`met.no ${res.status}`);
  const body = await res.json();
  const until = Date.now() + NIGHT_HOURS * 3600 * 1000;
  let mm = 0;
  for (const t of body?.properties?.timeseries ?? []) {
    if (Date.parse(t.time) > until) break;
    const temp = t.data?.instant?.details?.air_temperature;
    const rain = t.data?.next_1_hours?.details?.precipitation_amount;
    if (typeof temp === 'number' && typeof rain === 'number' && temp <= SNOW_TEMP) mm += rain;
  }
  return mm;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return new Response('forbidden', { status: 403 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sent: Record<string, number> = {};
  for (const [kommune, [lat, lon]] of Object.entries(KOMMUNER)) {
    try {
      // one kommune's bad forecast must not stop the others
      if ((await snowTonightMm(lat, lon)) < MIN_SNOW_MM) continue;
      const { data, error } = await db.rpc('snow_alert', { p_kommune: kommune });
      if (error) throw error;
      sent[kommune] = data as number;
    } catch (e) {
      console.error('snow-alert', kommune, e);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
