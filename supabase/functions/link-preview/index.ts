// Supabase Edge Function: a preview card for a link in the chat (asked 2026-11-09).
//
// The page is fetched here, not on the phones: the other person's phone never contacts a site just because a
// link was sent to them. Only for signed-in people. Only public http(s) addresses: no IP addresses, no local or
// private networks (checked again after every redirect), at most 3 redirects, 5 seconds and 512 KB of HTML.
// Returns the page's own title, description and picture (Open Graph), or { preview: null }.
//
// Deploy: npx supabase functions deploy link-preview
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const UA = 'MinNaboLinkPreview/1.0 (+https://minnaboapp.no)';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=86400' },
  });

/** 10.x, 127.x, 169.254.x, 172.16–31.x, 192.168.x, 100.64–127.x, 0.x, and the IPv6 local ranges. */
function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function isPublicUrl(u: URL): Promise<boolean> {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== '80' && u.port !== '443') return false;
  const host = u.hostname.toLowerCase();
  // a bare IP address or a local name is never a page a neighbour shares
  if (/^[\d.]+$/.test(host) || host.includes(':') || !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host === 'localhost') return false;
  try {
    const ips = [...(await Deno.resolveDns(host, 'A').catch(() => [])), ...(await Deno.resolveDns(host, 'AAAA').catch(() => []))];
    return ips.length > 0 && !ips.some(isPrivateIp);
  } catch {
    return false;
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return null;
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(size, MAX_BYTES));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, all.length - at));
    all.set(part, at);
    at += part.length;
    if (at >= all.length) break;
  }
  return new TextDecoder().decode(all);
}

async function fetchPage(start: URL): Promise<{ url: URL; html: string } | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicUrl(url))) return null;
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.5' },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      await res.body?.cancel();
      if (!next) return null;
      url = new URL(next, url);
      continue;
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) {
      await res.body?.cancel();
      return null;
    }
    return { url, html: await readLimited(res) };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Ikke innlogget.' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: who } = await admin.auth.getUser(jwt);
    if (!who.user) return json({ error: 'Ikke innlogget.' }, 401);

    const { url } = (await req.json()) as { url?: string };
    if (!url || url.length > 2000) return json({ preview: null });
    let start: URL;
    try {
      start = new URL(url);
    } catch {
      return json({ preview: null });
    }
    const page = await fetchPage(start);
    if (!page) return json({ preview: null });

    const { html } = page;
    const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null);
    if (!title) return json({ preview: null });
    const description = meta(html, ['og:description', 'twitter:description', 'description']);
    const site = meta(html, ['og:site_name']);
    let image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image']);
    if (image) {
      try {
        const abs = new URL(image, page.url);
        image = abs.protocol === 'https:' ? abs.toString() : null;
      } catch {
        image = null;
      }
    }
    return json({
      preview: {
        url: page.url.toString(),
        host: page.url.hostname.replace(/^www\./, ''),
        title: title.slice(0, 160),
        description: description ? description.slice(0, 240) : null,
        site: site ? site.slice(0, 60) : null,
        image,
      },
    });
  } catch {
    // a slow or odd page is simply a link without a card
    return json({ preview: null });
  }
});
