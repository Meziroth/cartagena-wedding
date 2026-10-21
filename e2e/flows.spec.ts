// The main things people do, end to end, on the example data.
import { expect, test } from '@playwright/test';

test('budget: a smaller total rebalances, and an extra event can be fitted back in', async ({ page }) => {
  await page.goto('#/budget');
  const status = page.locator('.status-line');
  await expect(status).toContainText('matches your total');
  await page.getByRole('button', { name: '−10%' }).click();
  await expect(page.locator('.total-big')).toHaveText('$13,500');
  await expect(status).toContainText('matches your total');
  await expect(page.getByLabel('Florals & décor amount')).toHaveValue('1800'); // locked must-have kept

  await page.getByRole('button', { name: 'Rehearsal dinner', exact: true }).click();
  await expect(status).toContainText('Over by');
  await status.getByRole('button', { name: 'Rebalance to fit' }).click();
  await expect(status).toContainText('matches your total');
});

test('budget: the slider keeps the plan matching while it moves', async ({ page }) => {
  await page.goto('#/budget');
  await page.getByLabel('Adjust total').focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.total-big')).toHaveText('$16,000');
  await expect(page.locator('.status-line')).toContainText('matches your total');
});

test('checklist: add a task, tick it off, see it counted', async ({ page }) => {
  await page.goto('#/checklist');
  await expect(page.getByText('3 of 35 done')).toBeVisible();
  await page.getByText('Add task').click();
  await page.getByLabel('Task', { exact: true }).fill('Book the boat to Rosario');
  await page.getByLabel('Due', { exact: true }).fill('2027-06-01');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('3 of 36 done')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Done: Book the boat to Rosario' }).check();
  await expect(page.getByText('4 of 36 done')).toBeVisible();
});

test('details: moving the date moves the checklist', async ({ page }) => {
  await page.goto('#/checklist');
  const firstDue = await page.locator('.task .t-meta span').first().innerText();
  await page.goto('#/details');
  await page.locator('#dDate').fill('2028-02-05');
  await page.locator('#dDate').press('Enter');
  await expect(page.locator('.toast')).toContainText('The checklist moved with it');
  await page.goto('#/checklist');
  await expect(page.locator('.task .t-meta span').first()).not.toHaveText(firstDue);
});

test('notes: tags appear only when used, and filter the list', async ({ page }) => {
  await page.goto('#/notes');
  await page.getByLabel('New entry').fill('Ask about a rain plan');
  await page.getByRole('button', { name: '+ Tag' }).click();
  await page.getByLabel('Add a tag').fill('Venue');
  await page.getByLabel('Add a tag').press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /^#venue/ }).click();
  await expect(page.locator('.note')).toHaveCount(1);
  await expect(page.locator('.note-body')).toHaveText('Ask about a rain plan');
});

test('inspiration: heart an idea so both love it', async ({ page }) => {
  await page.goto('#/inspiration');
  const card = page.locator('.idea', { hasText: 'Bougainvillea spilling' });
  await expect(card).not.toContainText('Both love it');
  await card.getByRole('button', { name: /^Nick hasn’t hearted this/ }).click();
  await expect(card).toContainText('Both love it');
});

test('suggestions: dismissing one hides it', async ({ page }) => {
  await page.goto('#/');
  const sugg = page.locator('section', { has: page.getByRole('heading', { name: 'Suggestions' }) });
  await sugg.getByRole('button', { name: /^Show all/ }).click();
  await sugg.getByRole('button', { name: 'Dismiss suggestion: Add a hora loca' }).click();
  await expect(sugg.getByText('Add a hora loca')).toHaveCount(0);
});

test('offline: a banner explains, edits wait, and are kept when back online', async ({ page, context }) => {
  await page.goto('#/guests');
  await expect(page.getByRole('heading', { name: 'Guests', level: 2 })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('You’re offline.')).toBeVisible();
  await page.getByLabel('RSVP for Aunt Maria').selectOption('Yes');
  await expect(page.getByLabel('RSVP for Aunt Maria')).toHaveValue('Yes');
  await context.setOffline(false);
  await expect(page.getByText('You’re offline.')).toHaveCount(0);
  await expect(page.getByLabel('RSVP for Aunt Maria')).toHaveValue('Yes');
});

test('keyboard: skip link moves focus to the content', async ({ page }) => {
  await page.goto('#/budget');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.wrap.view')).toBeFocused();
});
