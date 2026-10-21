// Every screen at phone (390×844) and desktop (1280×800) size: it renders, nothing scrolls sideways,
// and axe finds no serious or critical accessibility problems.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SCREENS: [path: string, heading: string][] = [
  ['', 'Nick & Thuraya'],
  ['checklist', 'Checklist'],
  ['budget', 'Budget'],
  ['vendors', 'Vendors'],
  ['inspiration', 'Inspiration'],
  ['guests', 'Guests'],
  ['notes', 'Notes & decisions'],
  ['details', 'Wedding details'],
];

for (const [path, heading] of SCREENS) {
  test(`${path || 'home'}: renders, fits the screen, passes axe`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Resource failures are checked by address below; outside sites (Google Fonts) can be slow on any network.
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
    page.on('response', (r) => { if (r.url().startsWith('http://localhost') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

    await page.goto(`#/${path}`);
    await expect(page.getByRole('heading', { name: heading, level: path ? 2 : 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sideways, 'page scrolls sideways').toBeLessThanOrEqual(0);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('unknown addresses show "Page not found"', async ({ page }) => {
  await page.goto('#/nowhere');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('dark theme passes axe on Home and Budget', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const path of ['', 'budget']) {
    await page.goto(`#/${path}`);
    await expect(page.locator('h1, h2').first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${path || 'home'} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
  }
});
