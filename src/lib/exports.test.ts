import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { buildMockData } from '../mock/mockData';
import { backupJson, budgetCsv, csvCell, foldLine, icsCalendar, icsText, TODOIST_HEADER, todoistCsv } from './exports';

const t = i18n.t;
const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0));

describe('CSV', () => {
  it('quotes when needed and guards spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('Florals, décor')).toBe('"Florals, décor"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")', true)).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('-50', true)).toBe("'-50");
  });

  it('exports the budget: active categories, then the total, with COP at the stored rate', () => {
    const lines = budgetCsv(buildMockData(), t).replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('Event,Category,Planned USD,Planned COP,Paid USD,Must-have');
    expect(lines).toContain('Ceremony & reception,"Florals & décor",1800,5749200,0,Yes'.replace('"Florals & décor"', 'Florals & décor'));
    expect(lines.some((l) => l.startsWith('Rehearsal dinner'))).toBe(false);
    expect(lines.at(-1)).toBe(',Total budget,15000,47910000,,');
    expect(lines).toHaveLength(1 + 14 + 1);
  });

  it('exports open tasks for Todoist with a section per month', () => {
    const rows = todoistCsv(buildMockData()).trim().split('\r\n');
    expect(rows[0]).toBe(TODOIST_HEADER.join(','));
    expect(rows[1]).toBe('section,November 2026,,,,,,,,,,,,'); // October's tasks are the three already done
    const task = rows.find((r) => r.startsWith('task,') && !r.includes('"'))!.split(',');
    expect(task).toHaveLength(14);
    expect(task.slice(3, 5)).toEqual(['4', '1']); // no priority, top level
    expect(task[8]).toBe('en');
    expect(task[11]).toBe('None');
    expect(rows.filter((r) => r.startsWith('task,'))).toHaveLength(32); // the three done tasks are left out
  });
});

describe('calendar (RFC 5545)', () => {
  const ics = icsCalendar(buildMockData(), t, NOW);

  it('uses CRLF line endings and wraps every event', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1 + 3 + 32);
  });

  it('gives each event a stable id from its row, so re-importing updates instead of duplicating', () => {
    expect(ics).toContain('UID:wedding-w-mock@nick-thuraya-wedding');
    expect(ics).toContain('UID:payment-p-1@nick-thuraya-wedding');
    expect(ics).toContain('UID:task-t-4@nick-thuraya-wedding');
    expect(icsCalendar(buildMockData(), t, NOW)).toBe(ics);
  });

  it('writes all-day events ending the next day', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20280122\r\nDTEND;VALUE=DATE:20280123');
    expect(ics).toContain('DTSTAMP:20261021T120000Z');
  });

  it('escapes text and folds long lines at 75 octets', () => {
    expect(icsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
    const long = 'SUMMARY:' + 'Décor '.repeat(30);
    const folded = foldLine(long);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('backup', () => {
  it('holds every table and the export time', () => {
    const b = JSON.parse(backupJson(buildMockData(), NOW));
    expect(b.app).toBe('nick-thuraya-wedding');
    expect(b.exported_at).toBe('2026-10-21T12:00:00.000Z');
    for (const k of ['wedding', 'members', 'events', 'budget_categories', 'payments', 'tasks', 'vendors', 'ideas', 'idea_votes', 'guests', 'notes', 'dismissed_suggestions']) {
      expect(b).toHaveProperty(k);
    }
  });
});
