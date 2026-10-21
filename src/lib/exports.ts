// File exports: full JSON backup, budget CSV, calendar (.ics) and a Todoist CSV. Pure functions returning text.
import type { TFunction } from 'i18next';
import type { Dataset } from '../mock/mockData';
import { activeCategories, paidForCategory } from './budget';
import { addDays, fmtD } from './dates';
import { formatUSD } from './money';

// ─── CSV ─────────────────────────────────────────────────────────────────────────────────────────

/** Quotes a CSV cell when needed. `guardFormulas` stops spreadsheets running text like "=SUM(…)" as a formula. */
export function csvCell(v: string | number, guardFormulas = false): string {
  let s = String(v);
  if (guardFormulas && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csv = (rows: (string | number)[][], guard = false) => rows.map((r) => r.map((c) => csvCell(c, guard)).join(',')).join('\r\n') + '\r\n';

/** Event, Category, Planned USD, Planned COP, Paid USD, Must-have — active categories, then the total. */
export function budgetCsv(d: Dataset, t: TFunction): string {
  const rate = d.wedding.fx_cop_per_usd;
  const head = ['event', 'category', 'plannedUsd', 'plannedCop', 'paidUsd', 'mustHave'].map((k) => t(`exports.csv.${k}`));
  const rows: (string | number)[][] = [head];
  for (const c of activeCategories(d.budget_categories, d.events)) {
    rows.push([
      d.events.find((e) => e.id === c.event_id)?.name ?? '', c.name, c.amount_usd, Math.round(c.amount_usd * rate),
      paidForCategory(d.payments, c.id), t(c.is_locked ? 'exports.csv.yes' : 'exports.csv.no'),
    ]);
  }
  rows.push(['', t('exports.csv.total'), d.wedding.total_budget_usd, Math.round(d.wedding.total_budget_usd * rate), '', '']);
  // The byte-order mark makes Excel read accents (Décor) correctly.
  return '\uFEFF' + csv(rows, true);
}

export const TODOIST_HEADER = [
  'TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT', 'AUTHOR', 'RESPONSIBLE', 'DATE', 'DATE_LANG', 'TIMEZONE',
  'DURATION', 'DURATION_UNIT', 'DEADLINE', 'DEADLINE_LANG',
];

/**
 * Open tasks in Todoist's CSV import format, one section per month. Checked against Todoist's help page
 * "Import or export a project as a CSV file": TYPE is lowercase task/section; PRIORITY 4 is the lowest, i.e.
 * no priority (an empty cell would make every task p1); an empty TIMEZONE lets Todoist use the account's own;
 * DURATION_UNIT is "None" when there's no duration.
 */
export function todoistCsv(d: Dataset): string {
  const rows: string[][] = [TODOIST_HEADER];
  const blank = TODOIST_HEADER.map(() => '');
  const open = d.tasks.filter((x) => !x.is_done).sort((a, b) => a.due_date.localeCompare(b.due_date) || a.sort - b.sort);
  let month = '';
  for (const x of open) {
    const m = x.due_date.slice(0, 7);
    if (m !== month) {
      if (month) rows.push(blank);
      rows.push(['section', fmtD(`${m}-01`, { month: 'long', year: 'numeric' }), '', '', '', '', '', '', '', '', '', '', '', '']);
      month = m;
    }
    rows.push(['task', x.title, `${x.area} · ${x.assignee}`, '4', '1', '', '', x.due_date, 'en', '', '', 'None', '', '']);
  }
  return csv(rows);
}

// ─── Calendar (RFC 5545) ─────────────────────────────────────────────────────────────────────────

/** Escapes TEXT values: backslash, semicolon, comma and newlines. */
export const icsText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds lines longer than 75 octets (UTF-8), continuing with a leading space, without splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75; // continuation lines start with a space
    if (size + n > limit) { parts.push(cur); cur = ''; size = 0; }
    cur += ch;
    size += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const icsDate = (iso: string) => iso.replace(/-/g, '');
const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * The wedding day, unpaid payments and open tasks as all-day events. UIDs come from the row ids, so importing
 * the file again updates the same events instead of adding copies.
 */
export function icsCalendar(d: Dataset, t: TFunction, now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nick & Thuraya//Wedding Planner//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(t('exports.calendarName'))}`];
  const event = (uid: string, date: string, summary: string, description: string, location?: string) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@nick-thuraya-wedding`, `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(date, 1))}`,
      `SUMMARY:${icsText(summary)}`, `DESCRIPTION:${icsText(description)}`);
    if (location) lines.push(`LOCATION:${icsText(location)}`);
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
  };
  event(`wedding-${d.wedding.id}`, d.wedding.wedding_date, t('exports.weddingEvent'), t('exports.weddingWhere'), t('exports.weddingWhere'));
  for (const p of d.payments.filter((x) => !x.is_paid)) {
    event(`payment-${p.id}`, p.due_date, t('exports.payEvent', { label: p.label, amount: formatUSD(p.amount_usd) }), t('exports.payDesc'));
  }
  for (const x of d.tasks.filter((y) => !y.is_done)) {
    event(`task-${x.id}`, x.due_date, t('exports.taskEvent', { title: x.title }), `${x.area} · ${x.assignee}`);
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// ─── Backup ──────────────────────────────────────────────────────────────────────────────────────

/** Every row of the wedding. Photos and contracts appear as storage paths, not file contents. */
export function backupJson(d: Dataset, now = new Date()): string {
  return JSON.stringify({ app: 'nick-thuraya-wedding', format: 1, exported_at: now.toISOString(), ...d }, null, 2);
}
