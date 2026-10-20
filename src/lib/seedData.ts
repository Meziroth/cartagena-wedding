// Starting data for a new wedding, ported from reference/prototype.html seed() and TEMPLATE.
// The database seed function uses the same values; supabase/tests checks the two stay in sync.
import type { Assignee, NoteType } from '../types';

export const DEFAULT_WEDDING_DATE = '2028-01-22';
export const DATE_MIN = '2027-12-01';
export const DATE_MAX = '2028-02-29';
export const DEFAULT_TOTAL_USD = 15000;
export const DEFAULT_GUESTS = 40;
export const DEFAULT_FX = 3194;

export const SEED_EVENTS: { key: string; name: string; is_on: boolean; is_fixed: boolean }[] = [
  { key: 'welcome', name: 'Welcome drinks', is_on: true, is_fixed: false },
  { key: 'main', name: 'Ceremony & reception', is_on: true, is_fixed: true },
  { key: 'rehearsal', name: 'Rehearsal dinner', is_on: false, is_fixed: false },
  { key: 'dayafter', name: 'Day-after: Rosario Islands boat day', is_on: false, is_fixed: false },
];

/** [key, name, amount USD, locked, event key] */
export const SEED_CATEGORIES: [string, string, number, boolean, string][] = [
  ['venue', 'Venue: hacienda', 2600, false, 'main'],
  ['catering', 'Catering & bar', 3300, false, 'main'],
  ['florals', 'Florals & décor', 1800, true, 'main'],
  ['lighting', 'Lighting: string lights & candles', 700, true, 'main'],
  ['photo', 'Photography', 1500, false, 'main'],
  ['music', 'Music: DJ & hora loca band', 900, false, 'main'],
  ['planner', 'Planner / coordinator', 1200, false, 'main'],
  ['attire', 'Attire & beauty', 1200, false, 'main'],
  ['cake', 'Cake & desserts', 300, false, 'main'],
  ['ceremony', 'Officiant & ceremony', 250, false, 'main'],
  ['stationery', 'Stationery & guest website', 150, false, 'main'],
  ['favors', 'Favors & welcome bags', 200, false, 'main'],
  ['buffer', 'Buffer', 300, false, 'main'],
  ['welcome', 'Welcome drinks', 600, false, 'welcome'],
  ['rehearsal', 'Rehearsal dinner', 800, false, 'rehearsal'],
  ['dayafter', 'Rosario Islands boat day', 1000, false, 'dayafter'],
];

/** [months before, title, area, assignee, done] */
export const TASK_TEMPLATE: [number, string, string, Assignee, boolean?][] = [
  [15, 'Set date window and guest count', 'Planning', 'Both', true],
  [15, 'Agree on a total budget', 'Budget', 'Both', true],
  [15, 'Start the inspiration board', 'Décor', 'Thuraya', true],
  [14.5, 'Decide: legal ceremony at home, symbolic in Cartagena, or legal in Colombia', 'Legal', 'Both'],
  [14.5, 'Hire a Cartagena wedding planner or coordinator', 'Vendors', 'Nick'],
  [14, 'Tour hacienda venues (video calls or a scouting trip)', 'Venue', 'Both'],
  [13, 'Book the hacienda and sign the contract', 'Venue', 'Both'],
  [13, 'Choose and confirm the wedding date', 'Planning', 'Both'],
  [12.5, 'Block hotel rooms in the walled city or Getsemaní', 'Travel', 'Nick'],
  [12, 'Draft the guest list', 'Guests', 'Both'],
  [12, 'Book the photographer', 'Vendors', 'Thuraya'],
  [11, 'Send save-the-dates (9–12 months out for destination weddings)', 'Guests', 'Thuraya'],
  [11, 'Publish a guest info page: flights, hotels, passports, weather', 'Guests', 'Nick'],
  [10, 'Book the florist and share the inspiration board', 'Florals', 'Thuraya'],
  [10, 'Book catering and bar, or confirm what the venue includes', 'Catering', 'Planner'],
  [10, 'Book music: DJ plus a band for the hora loca', 'Music', 'Nick'],
  [9, 'Plan the lighting: string lights, candles, lanterns', 'Décor', 'Planner'],
  [9, 'Shop for wedding attire', 'Attire', 'Both'],
  [9, 'Pick a welcome-drinks spot', 'Events', 'Planner'],
  [6, 'Send invitations with an RSVP link', 'Guests', 'Thuraya'],
  [6, 'Book hair and makeup', 'Attire', 'Thuraya'],
  [6, 'Plan guest transport: airport to hotels, hotels to hacienda', 'Travel', 'Planner'],
  [5, 'Order welcome bags and favors', 'Décor', 'Thuraya'],
  [4, 'Menu and cake tasting', 'Catering', 'Both'],
  [4, 'Finalize the floral and décor plan', 'Florals', 'Planner'],
  [4, 'Buy wedding rings', 'Attire', 'Both'],
  [3, 'Chase RSVPs and confirm guest travel', 'Guests', 'Nick'],
  [3, 'Write the ceremony script and vows', 'Ceremony', 'Both'],
  [2, 'Build the day-of timeline with the planner', 'Planning', 'Planner'],
  [2, 'Review the final payment schedule', 'Budget', 'Nick'],
  [1.5, 'Seating plan', 'Guests', 'Thuraya'],
  [1, 'Give the final headcount to the caterer', 'Catering', 'Planner'],
  [1, 'Confirm every vendor: arrival times, contacts on WhatsApp', 'Vendors', 'Planner'],
  [0.25, 'Final walkthrough at the hacienda', 'Venue', 'Both'],
  [0.25, 'Withdraw COP cash for final balances and tips', 'Budget', 'Nick'],
];

export const SEED_NOTES: [NoteType, string][] = [
  ['decision', 'Budget set at $15,000 USD. It can flex up or down as life changes.'],
  ['decision', 'Guest count: 30–50 people.'],
  ['decision', 'Date window: December 2027 to February 2028.'],
  ['decision', 'Vision: a Cartagena hacienda with a beautiful courtyard, soft lights, lots of flowers and color.'],
  ['decision', 'Events: welcome drinks plus ceremony & reception. Rehearsal dinner and a day-after event are optional.'],
  ['decision', 'Our planner can edit tasks, vendors and the timeline. The budget is view-only for the planner.'],
];

export const TASK_AREAS = ['Planning', 'Venue', 'Vendors', 'Guests', 'Travel', 'Florals', 'Décor', 'Catering', 'Music', 'Attire', 'Ceremony', 'Legal', 'Budget', 'Events'];
export const ASSIGNEES = ['Both', 'Nick', 'Thuraya', 'Planner'] as const;
export const IDEA_TAGS = ['Venue', 'Florals', 'Lighting', 'Décor', 'Palette', 'Attire', 'Cake', 'Other'] as const;
export const RSVPS = ['Pending', 'Yes', 'Maybe', 'No'] as const;
export const TRAVELS = ['Not yet', 'Flights booked', 'Flights + hotel'] as const;
export const SIDES = ['Nick', 'Thuraya', 'Both'] as const;
export const VENDOR_STATUS_COUNT = 5;
