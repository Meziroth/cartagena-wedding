-- Nick & Thuraya's wedding planner: schema, row level security, storage and realtime.
--
-- Security model
--   * Every table has RLS on. Nothing is readable without a row in public.members.
--   * Owners (Nick, Thuraya) can do everything. The planner can edit tasks, vendors, guests, notes and ideas,
--     but weddings, members, events, budget_categories and payments are read-only for them.
--   * Money is integer whole USD. COP is display-only, via weddings.fx_cop_per_usd.
--   * Rows that point at other rows (category → event, payment → category, …) use composite foreign keys that
--     include wedding_id, so a row can never reference another wedding's data.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table public.weddings (
  id               uuid primary key default gen_random_uuid(),
  couple_names     text not null default 'Nick & Thuraya',
  wedding_date     date not null default '2028-01-22',
  date_confirmed   boolean not null default false,
  guest_target     integer not null default 40 check (guest_target between 1 and 500),
  total_budget_usd integer not null default 15000 check (total_budget_usd >= 0),
  fx_cop_per_usd   numeric(10, 2) not null default 3194 check (fx_cop_per_usd > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.members (
  wedding_id   uuid not null references public.weddings (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null,
  role         text not null check (role in ('owner', 'planner')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (wedding_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  key        text not null,
  name       text not null check (length(name) between 1 and 200),
  is_on      boolean not null default false,
  is_fixed   boolean not null default false,
  sort       integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (wedding_id, key),
  unique (id, wedding_id)
);

create table public.budget_categories (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  event_id   uuid not null,
  -- Stable key for seeded categories (venue, catering, florals, buffer…); null for ones the couple adds.
  key        text,
  name       text not null check (length(name) between 1 and 200),
  amount_usd integer not null default 0 check (amount_usd >= 0),
  is_locked  boolean not null default false,
  is_buffer  boolean not null default false,
  sort       integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (wedding_id, key),
  unique (id, wedding_id),
  foreign key (event_id, wedding_id) references public.events (id, wedding_id) on delete cascade
);
create index budget_categories_wedding_idx on public.budget_categories (wedding_id);
-- At most one buffer per wedding.
create unique index budget_categories_one_buffer on public.budget_categories (wedding_id) where is_buffer;

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  category_id uuid,
  label       text not null check (length(label) between 1 and 200),
  amount_usd  integer not null check (amount_usd >= 0),
  due_date    date not null,
  is_paid     boolean not null default false,
  paid_at     timestamptz,
  updated_at  timestamptz not null default now(),
  foreign key (category_id, wedding_id) references public.budget_categories (id, wedding_id)
    on delete set null (category_id)
);
create index payments_wedding_idx on public.payments (wedding_id);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  title         text not null check (length(title) between 1 and 300),
  area          text not null default 'Planning',
  assignee      text not null default 'Both' check (assignee in ('Both', 'Nick', 'Thuraya', 'Planner')),
  due_date      date not null,
  is_done       boolean not null default false,
  done_by       uuid references auth.users (id) on delete set null,
  done_at       timestamptz,
  -- Months before the wedding for template tasks; null for custom tasks.
  months_before numeric(4, 2),
  sort          integer not null default 0,
  updated_at    timestamptz not null default now()
);
create index tasks_wedding_idx on public.tasks (wedding_id, due_date);

create table public.vendors (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  category_id   uuid,
  name          text not null check (length(name) between 1 and 200),
  -- 0 Researching, 1 Contacted, 2 Quote received, 3 Booked, 4 Paid in full
  status        smallint not null default 0 check (status between 0 and 4),
  quote_usd     integer check (quote_usd >= 0),
  contact       text not null default '',
  notes         text not null default '',
  contract_path text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (category_id, wedding_id) references public.budget_categories (id, wedding_id)
    on delete set null (category_id)
);
create index vendors_wedding_idx on public.vendors (wedding_id);

create table public.ideas (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings (id) on delete cascade,
  kind              text not null check (kind in ('image', 'link')),
  title             text not null default '',
  tag               text not null default 'Other'
                      check (tag in ('Venue', 'Florals', 'Lighting', 'Décor', 'Palette', 'Attire', 'Cake', 'Other')),
  storage_path      text,
  url               text,
  preview_title     text,
  preview_image_url text,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (kind <> 'image' or storage_path is not null),
  check (kind <> 'link' or url is not null)
);
create index ideas_wedding_idx on public.ideas (wedding_id, created_at desc);

create table public.idea_votes (
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create table public.guests (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name       text not null check (length(name) between 1 and 200),
  party_size integer not null default 1 check (party_size between 1 and 50),
  side       text not null default 'Both' check (side in ('Nick', 'Thuraya', 'Both')),
  rsvp       text not null default 'Pending' check (rsvp in ('Pending', 'Yes', 'Maybe', 'No')),
  travel     text not null default 'Not yet' check (travel in ('Not yet', 'Flights booked', 'Flights + hotel')),
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_wedding_idx on public.guests (wedding_id);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  type       text not null default 'note' check (type in ('decision', 'note', 'question')),
  body       text not null check (length(body) between 1 and 5000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_wedding_idx on public.notes (wedding_id, created_at desc);

create table public.dismissed_suggestions (
  wedding_id     uuid not null references public.weddings (id) on delete cascade,
  suggestion_key text not null,
  updated_at     timestamptz not null default now(),
  primary key (wedding_id, suggestion_key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────────

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['weddings', 'members', 'events', 'budget_categories', 'payments', 'tasks', 'vendors',
                           'ideas', 'idea_votes', 'guests', 'notes', 'dismissed_suggestions']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Who ticked a task and when is recorded by the server, not trusted from the client.
create function public.tasks_track_done() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_done and (tg_op = 'INSERT' or not old.is_done) then
    new.done_by := coalesce(auth.uid(), new.done_by);
    new.done_at := now();
  elsif not new.is_done then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end $$;
create trigger tasks_track_done before insert or update of is_done on public.tasks
  for each row execute function public.tasks_track_done();

create function public.payments_track_paid() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_paid and (tg_op = 'INSERT' or not old.is_paid) then
    new.paid_at := coalesce(new.paid_at, now());
  elsif not new.is_paid then
    new.paid_at := null;
  end if;
  return new;
end $$;
create trigger payments_track_paid before insert or update of is_paid on public.payments
  for each row execute function public.payments_track_paid();

-- Authorship comes from the session.
create function public.set_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
create trigger set_created_by before insert on public.ideas for each row execute function public.set_created_by();
create trigger set_created_by before insert on public.notes for each row execute function public.set_created_by();

-- The buffer category can't be deleted (it still goes when its whole wedding or event is deleted).
create function public.protect_buffer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_buffer and exists (select 1 from public.events e where e.id = old.event_id) then
    raise exception 'The buffer category can''t be deleted.' using errcode = 'check_violation';
  end if;
  return old;
end $$;
create trigger protect_buffer before delete on public.budget_categories
  for each row execute function public.protect_buffer();

-- A wedding always keeps at least one owner.
-- These two guards are security definer: they must see the real rows, not what RLS lets the current user see
-- (otherwise, mid-statement, an owner who just removed themselves could no longer see the wedding).
create function public.keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.weddings w where w.id = old.wedding_id)
     and not exists (select 1 from public.members m
                     where m.wedding_id = old.wedding_id and m.role = 'owner' and m.user_id <> old.user_id) then
    raise exception 'A wedding needs at least one owner.' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;
create trigger keep_an_owner before update of role or delete on public.members
  for each row execute function public.keep_an_owner();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS helpers
-- security definer so they can read members without recursing through members' own policies.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.is_member(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.wedding_id = w and m.user_id = auth.uid());
$$;

create function public.is_owner(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.wedding_id = w and m.user_id = auth.uid() and m.role = 'owner');
$$;

-- For storage paths like '{wedding_id}/{uuid}.jpg': returns null instead of failing on a malformed segment.
create function public.path_wedding_id(path text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end $$;

revoke execute on function public.is_member(uuid), public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.path_wedding_id(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.weddings              enable row level security;
alter table public.members               enable row level security;
alter table public.events                enable row level security;
alter table public.budget_categories     enable row level security;
alter table public.payments              enable row level security;
alter table public.tasks                 enable row level security;
alter table public.vendors               enable row level security;
alter table public.ideas                 enable row level security;
alter table public.idea_votes            enable row level security;
alter table public.guests                enable row level security;
alter table public.notes                 enable row level security;
alter table public.dismissed_suggestions enable row level security;

-- Signed-out visitors get nothing at all, even before RLS is considered.
revoke all on all tables in schema public from anon;

-- weddings: members read; owners update or delete. New weddings come from setup_wedding() only.
create policy "members read" on public.weddings for select to authenticated using (public.is_member(id));
create policy "owners update" on public.weddings for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy "owners delete" on public.weddings for delete to authenticated using (public.is_owner(id));

-- members: members read their wedding's members; only owners change them.
create policy "members read" on public.members for select to authenticated using (public.is_member(wedding_id));
create policy "owners insert" on public.members for insert to authenticated with check (public.is_owner(wedding_id));
create policy "owners update" on public.members for update to authenticated
  using (public.is_owner(wedding_id)) with check (public.is_owner(wedding_id));
create policy "owners delete" on public.members for delete to authenticated using (public.is_owner(wedding_id));

-- events, budget_categories, payments: members read; only owners write.
do $$
declare t text;
begin
  foreach t in array array['events', 'budget_categories', 'payments']
  loop
    execute format('create policy "members read" on public.%I for select to authenticated
                    using (public.is_member(wedding_id))', t);
    execute format('create policy "owners insert" on public.%I for insert to authenticated
                    with check (public.is_owner(wedding_id))', t);
    execute format('create policy "owners update" on public.%I for update to authenticated
                    using (public.is_owner(wedding_id)) with check (public.is_owner(wedding_id))', t);
    execute format('create policy "owners delete" on public.%I for delete to authenticated
                    using (public.is_owner(wedding_id))', t);
  end loop;
end $$;

-- tasks, vendors, guests, notes, ideas, dismissed_suggestions: every member can do everything in their wedding.
do $$
declare t text;
begin
  foreach t in array array['tasks', 'vendors', 'guests', 'notes', 'ideas', 'dismissed_suggestions']
  loop
    execute format('create policy "members all" on public.%I for all to authenticated
                    using (public.is_member(wedding_id)) with check (public.is_member(wedding_id))', t);
  end loop;
end $$;

-- idea_votes: members see the votes on their wedding's ideas. Owners add or remove only their own heart.
-- The planner has no heart.
create policy "members read" on public.idea_votes for select to authenticated
  using (exists (select 1 from public.ideas i where i.id = idea_id and public.is_member(i.wedding_id)));
create policy "owners add own vote" on public.idea_votes for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.ideas i where i.id = idea_id and public.is_owner(i.wedding_id)));
create policy "remove own vote" on public.idea_votes for delete to authenticated
  using (user_id = auth.uid()
         and exists (select 1 from public.ideas i where i.id = idea_id and public.is_member(i.wedding_id)));

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: private buckets, objects stored as '{wedding_id}/{uuid}.{ext}'
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('inspiration', 'inspiration', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('contracts',   'contracts',   false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "members read wedding files" on storage.objects for select to authenticated
  using (bucket_id in ('inspiration', 'contracts') and public.is_member(public.path_wedding_id(name)));
create policy "members upload wedding files" on storage.objects for insert to authenticated
  with check (bucket_id in ('inspiration', 'contracts') and public.is_member(public.path_wedding_id(name)));
create policy "members update wedding files" on storage.objects for update to authenticated
  using (bucket_id in ('inspiration', 'contracts') and public.is_member(public.path_wedding_id(name)))
  with check (bucket_id in ('inspiration', 'contracts') and public.is_member(public.path_wedding_id(name)));
create policy "members delete wedding files" on storage.objects for delete to authenticated
  using (bucket_id in ('inspiration', 'contracts') and public.is_member(public.path_wedding_id(name)));

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: every table, with full old rows so deletes carry wedding_id for filtering.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['weddings', 'members', 'events', 'budget_categories', 'payments', 'tasks', 'vendors',
                           'ideas', 'idea_votes', 'guests', 'notes', 'dismissed_suggestions']
  loop
    execute format('alter table public.%I replica identity full', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;
