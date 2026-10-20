// In-memory example data for development and browser tests (VITE_DATA_SOURCE=mock).
// Unlike the real seed, it includes the prototype's example vendors, payments, guests and ideas.
import { minusMonths } from '../lib/dates';
import {
  DEFAULT_FX, DEFAULT_GUESTS, DEFAULT_TOTAL_USD, DEFAULT_WEDDING_DATE,
  SEED_CATEGORIES, SEED_EVENTS, SEED_NOTES, TASK_TEMPLATE,
} from '../lib/seedData';
import type {
  BudgetCategory, DismissedSuggestion, Guest, Idea, IdeaVote, Member, Note, Payment, Task, Vendor, Wedding, WeddingEvent,
} from '../types';

export const MOCK_WEDDING_ID = 'w-mock';
export const MOCK_USERS = { nick: 'u-nick', thuraya: 'u-thuraya', planner: 'u-planner' } as const;

/** Sample artwork CSS classes for the example ideas (stand-ins until real photos are added). */
export const MOCK_ART: Record<string, { art: string; shape: string }> = {
  'i-lights': { art: 'art-lights', shape: '' },
  'i-bougain': { art: 'art-bougain', shape: 'tall' },
  'i-table': { art: 'art-table', shape: 'wide' },
  'i-helic': { art: 'art-helic', shape: '' },
  'i-doors': { art: 'art-doors', shape: 'wide' },
  'i-palette': { art: 'art-palette', shape: 'wide' },
};

export interface Dataset {
  wedding: Wedding;
  members: Member[];
  events: WeddingEvent[];
  budget_categories: BudgetCategory[];
  payments: Payment[];
  tasks: Task[];
  vendors: Vendor[];
  ideas: Idea[];
  idea_votes: IdeaVote[];
  guests: Guest[];
  notes: Note[];
  dismissed_suggestions: DismissedSuggestion[];
}

export function buildMockData(): Dataset {
  const w = MOCK_WEDDING_ID;
  const date = DEFAULT_WEDDING_DATE;
  const created = '2026-10-20T12:00:00Z';
  const { nick, thuraya, planner } = MOCK_USERS;

  const events: WeddingEvent[] = SEED_EVENTS.map((e, i) => ({ id: `e-${e.key}`, wedding_id: w, sort: i, ...e }));
  const cats: BudgetCategory[] = SEED_CATEGORIES.map(([key, name, amount, locked, ev], i) => ({
    id: `c-${key}`, wedding_id: w, event_id: `e-${ev}`, key, name, amount_usd: amount,
    is_locked: locked, is_buffer: key === 'buffer', sort: i,
  }));
  const idea = (id: string, title: string, tag: Idea['tag'], by: string, n: number): Idea => ({
    id, wedding_id: w, kind: 'image', title, tag, storage_path: null, url: null,
    preview_title: null, preview_image_url: null, created_by: by, created_at: `2026-10-20T12:0${n}:00Z`,
  });
  const votes: [string, string][] = [
    ['i-lights', nick], ['i-lights', thuraya], ['i-bougain', thuraya], ['i-table', nick], ['i-table', thuraya],
    ['i-helic', thuraya], ['i-doors', nick], ['i-palette', nick], ['i-palette', thuraya],
  ];

  return {
    wedding: {
      id: w, couple_names: 'Nick & Thuraya', wedding_date: date, date_confirmed: false,
      guest_target: DEFAULT_GUESTS, total_budget_usd: DEFAULT_TOTAL_USD, fx_cop_per_usd: DEFAULT_FX, created_at: created,
    },
    members: [
      { wedding_id: w, user_id: nick, email: 'nick@example.com', display_name: 'Nick', role: 'owner' },
      { wedding_id: w, user_id: thuraya, email: 'thuraya@example.com', display_name: 'Thuraya', role: 'owner' },
      { wedding_id: w, user_id: planner, email: 'planner@example.com', display_name: 'Planner', role: 'planner' },
    ],
    events,
    budget_categories: cats,
    payments: [
      { id: 'p-1', wedding_id: w, category_id: 'c-planner', label: 'Planner retainer', amount_usd: 400, due_date: '2026-11-30', is_paid: false, paid_at: null },
      { id: 'p-2', wedding_id: w, category_id: 'c-venue', label: 'Venue deposit (30%)', amount_usd: 780, due_date: '2026-12-15', is_paid: false, paid_at: null },
      { id: 'p-3', wedding_id: w, category_id: 'c-photo', label: 'Photographer deposit', amount_usd: 500, due_date: '2027-02-01', is_paid: false, paid_at: null },
    ],
    tasks: TASK_TEMPLATE.map(([m, title, area, assignee, done], i) => ({
      id: `t-${i + 1}`, wedding_id: w, title, area, assignee, due_date: minusMonths(date, m),
      is_done: !!done, done_by: done ? nick : null, done_at: done ? created : null, months_before: m, sort: i,
    })),
    vendors: [
      { id: 'v-1', wedding_id: w, category_id: 'c-venue', name: 'Hacienda venue: option A', status: 2, quote_usd: 2600, contact: 'WhatsApp +57 300 000 0000', notes: 'Courtyard seats 60. Tables and chairs included. Ask about the music curfew and rain plan.', contract_path: null },
      { id: 'v-2', wedding_id: w, category_id: 'c-florals', name: 'Florist: tropical and garden roses', status: 1, quote_usd: null, contact: 'Instagram DM', notes: 'Sent the inspiration board. Waiting on a quote for arches and long-table runners.', contract_path: null },
      { id: 'v-3', wedding_id: w, category_id: 'c-photo', name: 'Photographer based in Cartagena', status: 0, quote_usd: null, contact: '', notes: 'Shortlist three. Look for golden-hour and candlelight work.', contract_path: null },
      { id: 'v-4', wedding_id: w, category_id: 'c-music', name: 'Papayera band for the hora loca', status: 0, quote_usd: null, contact: '', notes: 'Ask for a 45-minute late-night set.', contract_path: null },
    ],
    ideas: [
      idea('i-palette', 'Palette: terracotta, bougainvillea, cream, sage', 'Palette', nick, 0),
      idea('i-doors', 'Colors of the old-city doors', 'Décor', nick, 1),
      idea('i-helic', 'Heliconias, orchids and white roses', 'Florals', thuraya, 2),
      idea('i-table', 'One long table with candles and greenery', 'Décor', nick, 3),
      idea('i-bougain', 'Bougainvillea spilling over plaster walls', 'Venue', thuraya, 4),
      idea('i-lights', 'Café lights over the courtyard', 'Lighting', thuraya, 5),
    ],
    idea_votes: votes.map(([idea_id, user_id]) => ({ idea_id, user_id })),
    guests: [
      { id: 'g-1', wedding_id: w, name: 'Rivera family', party_size: 4, side: 'Thuraya', rsvp: 'Pending', travel: 'Not yet', notes: '' },
      { id: 'g-2', wedding_id: w, name: 'Sam & Jordan', party_size: 2, side: 'Nick', rsvp: 'Yes', travel: 'Flights booked', notes: '' },
      { id: 'g-3', wedding_id: w, name: 'Aunt Maria', party_size: 1, side: 'Thuraya', rsvp: 'Maybe', travel: 'Not yet', notes: '' },
      { id: 'g-4', wedding_id: w, name: 'College friends', party_size: 6, side: 'Nick', rsvp: 'Pending', travel: 'Not yet', notes: '' },
    ],
    notes: SEED_NOTES.map(([type, body], i) => ({
      id: `n-${i + 1}`, wedding_id: w, type, body, created_by: nick, created_at: `2026-10-20T12:00:0${i}Z`,
    })),
    dismissed_suggestions: [],
  };
}
