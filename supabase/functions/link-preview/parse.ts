// Reading a page's preview (og:title, og:image) and deciding which addresses may be fetched.
// Plain TypeScript with no Deno APIs, so Vitest can test it too.

export interface Preview { title: string | null; image: string | null }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Attributes of every <meta> tag, lower-cased names. */
function metaTags(html: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      attrs[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? '');
    }
    out.push(attrs);
  }
  return out;
}

const clean = (s: string | undefined | null, max: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/** Only http(s) image addresses, resolved against the page. */
function absoluteHttp(src: string | undefined, base: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src.trim(), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch { return null; }
}

export function parsePreview(html: string, pageUrl: string): Preview {
  const metas = metaTags(html);
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const hit = metas.find((m) => (m.property ?? m.name ?? '').toLowerCase() === k && m.content);
      if (hit) return hit.content;
    }
    return undefined;
  };
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return {
    title: clean(pick('og:title', 'twitter:title') ?? (titleTag && decode(titleTag)), 200),
    image: absoluteHttp(pick('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'), pageUrl),
  };
}

/** Google Images result links carry the picture itself: …/imgres?imgurl=<image>&imgrefurl=<page>. */
export function googleImagesShortcut(url: URL): Preview | null {
  if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname) || url.pathname !== '/imgres') return null;
  const image = absoluteHttp(url.searchParams.get('imgurl') ?? undefined, url.toString());
  return image ? { title: null, image } : null;
}

/**
 * Refuses addresses that point inside a network (localhost, private and link-local ranges, cloud metadata),
 * so the function can't be used to probe Supabase's own infrastructure.
 */
export function isBlockedAddress(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  if (h.includes(':')) {
    // IPv6: loopback, unspecified, unique-local, link-local, and IPv4-mapped addresses.
    return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
  }
  return false;
}
