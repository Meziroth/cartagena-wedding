// Date helpers work on local calendar dates (yyyy-mm-dd) so nothing drifts across time zones.

export const todayISO = (): string => isoOf(new Date());

export const parseD = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fmtD = (
  iso: string | null | undefined,
  opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = 'en-US',
): string => (iso ? parseD(iso).toLocaleDateString(locale, opt) : '');

export const daysBetween = (a: string, b: string): number =>
  Math.round((parseD(b).getTime() - parseD(a).getTime()) / 864e5);

export const addDays = (iso: string, n: number): string => {
  const d = parseD(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};

/**
 * Whole months back from the date, then the fraction as ~30-day steps (as in the prototype).
 * Month steps clamp to the month's last day (Jan 31 − 2 months = Nov 30), matching Postgres and setup_wedding().
 */
export const minusMonths = (iso: string, m: number): string => {
  const src = parseD(iso);
  const d = new Date(src.getFullYear(), src.getMonth() - Math.floor(m), 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(src.getDate(), lastDay));
  if (m % 1) d.setDate(d.getDate() - Math.round((m % 1) * 30));
  return isoOf(d);
};

/** A server timestamp (ISO with time) → the local calendar date it falls on. */
export const localDate = (timestamp: string): string => isoOf(new Date(timestamp));
