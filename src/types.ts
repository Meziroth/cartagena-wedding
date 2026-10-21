// Row shapes mirror the Supabase tables in supabase/migrations/0001_init.sql.
// Money is integer whole USD. Dates are ISO yyyy-mm-dd strings.

export type Role = 'owner' | 'planner';
export type Assignee = 'Both' | 'Nick' | 'Thuraya' | 'Planner';
export type Side = 'Nick' | 'Thuraya' | 'Both';
export type Rsvp = 'Pending' | 'Yes' | 'Maybe' | 'No';
export type Travel = 'Not yet' | 'Flights booked' | 'Flights + hotel';
export type NoteType = 'decision' | 'note' | 'question';
export type IdeaTag = 'Venue' | 'Florals' | 'Lighting' | 'Décor' | 'Palette' | 'Attire' | 'Cake' | 'Other';
export type Currency = 'USD' | 'COP';

export interface Wedding {
  id: string;
  couple_names: string;
  wedding_date: string;
  date_confirmed: boolean;
  guest_target: number;
  total_budget_usd: number;
  fx_cop_per_usd: number;
  created_at: string;
}

export interface Member {
  wedding_id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: Role;
}

export interface WeddingEvent {
  id: string;
  wedding_id: string;
  key: string;
  name: string;
  is_on: boolean;
  is_fixed: boolean;
  sort: number;
}

export interface BudgetCategory {
  id: string;
  wedding_id: string;
  event_id: string;
  /** Stable key for seeded categories (venue, catering, florals, buffer…); null for ones the couple adds. */
  key: string | null;
  name: string;
  amount_usd: number;
  is_locked: boolean;
  is_buffer: boolean;
  sort: number;
}

export interface Payment {
  id: string;
  wedding_id: string;
  category_id: string | null;
  label: string;
  amount_usd: number;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
}

export interface Task {
  id: string;
  wedding_id: string;
  title: string;
  area: string;
  assignee: Assignee;
  due_date: string;
  is_done: boolean;
  done_by: string | null;
  done_at: string | null;
  months_before: number | null;
  sort: number;
}

export interface Vendor {
  id: string;
  wedding_id: string;
  category_id: string | null;
  name: string;
  /** 0–4: Researching, Contacted, Quote received, Booked, Paid in full */
  status: number;
  quote_usd: number | null;
  contact: string;
  notes: string;
  contract_path: string | null;
}

export interface Idea {
  id: string;
  wedding_id: string;
  kind: 'image' | 'link';
  title: string;
  tag: IdeaTag;
  storage_path: string | null;
  url: string | null;
  preview_title: string | null;
  preview_image_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface IdeaVote {
  idea_id: string;
  user_id: string;
}

export interface Guest {
  id: string;
  wedding_id: string;
  name: string;
  party_size: number;
  side: Side;
  rsvp: Rsvp;
  travel: Travel;
  notes: string;
}

export interface Note {
  id: string;
  wedding_id: string;
  type: NoteType;
  body: string;
  /** Free-form, made up by the couple and planner. Empty for most notes. */
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DismissedSuggestion {
  wedding_id: string;
  suggestion_key: string;
}
