import { describe, expect, it } from 'vitest';
import { googleImagesShortcut, isBlockedAddress, parsePreview } from '../functions/link-preview/parse.ts';

describe('link preview parsing', () => {
  it('reads og:title and og:image, in either attribute order, resolving relative images', () => {
    const html = `<html><head><title>Fallback</title>
      <meta content="Bougainvillea &amp; plaster walls" property="og:title">
      <meta property='og:image' content='/img/pin.jpg'></head></html>`;
    expect(parsePreview(html, 'https://www.pinterest.com/pin/123/')).toEqual({
      title: 'Bougainvillea & plaster walls', image: 'https://www.pinterest.com/img/pin.jpg',
    });
  });

  it('falls back to twitter tags and the <title>', () => {
    const html = '<title> Café  lights &#8211; courtyard </title><meta name="twitter:image" content="https://i.example.com/a.png">';
    expect(parsePreview(html, 'https://example.com/')).toEqual({ title: 'Café lights – courtyard', image: 'https://i.example.com/a.png' });
  });

  it('ignores non-web image addresses and empty pages', () => {
    expect(parsePreview('<meta property="og:image" content="javascript:alert(1)">', 'https://x.com/').image).toBeNull();
    expect(parsePreview('', 'https://x.com/')).toEqual({ title: null, image: null });
  });

  it('takes the picture straight from Google Images result links', () => {
    const u = new URL('https://www.google.com/imgres?imgurl=https%3A%2F%2Fcdn.example.com%2Fhacienda.jpg&imgrefurl=https%3A%2F%2Fblog.example.com');
    expect(googleImagesShortcut(u)).toEqual({ title: null, image: 'https://cdn.example.com/hacienda.jpg' });
    expect(googleImagesShortcut(new URL('https://www.google.com/search?q=x'))).toBeNull();
  });
});

describe('address blocking', () => {
  it('refuses local, private and metadata addresses', () => {
    for (const h of ['localhost', 'api.localhost', '127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254',
      '100.64.0.1', '0.0.0.0', '[::1]', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'metadata.google.internal', 'intranet']) {
      expect(isBlockedAddress(h), h).toBe(true);
    }
  });

  it('allows public sites', () => {
    for (const h of ['pin.it', 'www.pinterest.com', 'www.instagram.com', '8.8.8.8', '172.32.0.1', '2606:4700::1111']) {
      expect(isBlockedAddress(h), h).toBe(false);
    }
  });
});
