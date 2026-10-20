-- Row level security tests.
--
-- Runs inside one transaction and ROLLS BACK at the end, so it leaves no trace. Two ways to run it:
--   * `npm test` runs it in PGlite (Postgres in WebAssembly) against the migrations.
--   * Paste it into the Supabase SQL editor to check a real project. It needs an EMPTY project
--     (no wedding set up yet), because setup_wedding() only allows one wedding.
-- Any failed check raises an error naming what went wrong. Success ends with "All RLS checks passed".

begin;

-- Test-only helpers, rolled back with everything else.
create schema rls_test;
grant usage on schema rls_test to authenticated, anon;

create table rls_test.users (name text primary key, id uuid not null);
grant select on rls_test.users to authenticated, anon;
insert into rls_test.users values
  ('nick',     '00000000-0000-4000-8000-00000000000a'),
  ('thuraya',  '00000000-0000-4000-8000-00000000000b'),
  ('planner',  '00000000-0000-4000-8000-00000000000c'),
  ('stranger', '00000000-0000-4000-8000-00000000000d');
insert into auth.users (id, email)
  select id, name || '@rls-test.invalid' from rls_test.users;

create function rls_test.uid(who text) returns uuid language sql stable as $$
  select id from rls_test.users where name = who
$$;

-- Act as a signed-in user (role authenticated, JWT sub = their id) for the rest of the transaction.
create function rls_test.act_as(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', rls_test.uid(who), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Act as a signed-out visitor.
create function rls_test.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create function rls_test.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'RLS CHECK FAILED: %', what;
  end if;
end $$;

-- Runs a statement that must be refused with an error.
create function rls_test.refused(stmt text, what text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'RLS CHECK FAILED (was allowed): %', what;
exception
  when raise_exception then raise;
  when others then null;
end $$;

-- Runs a statement and returns how many rows it touched (RLS silently filters UPDATE and DELETE).
create function rls_test.affected(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema rls_test to authenticated, anon;

-- ─── Setup: Nick creates the wedding and invites Thuraya and the planner ───────────────────────

select rls_test.act_as('nick');
select rls_test.check(public.setup_wedding('Nick') is not null, 'Nick can set up the wedding');

do $$
declare w uuid := (select id from public.weddings);
begin
  perform rls_test.check((select count(*) from public.events) = 4, 'seed: 4 events');
  perform rls_test.check((select count(*) from public.budget_categories) = 16, 'seed: 16 budget categories');
  perform rls_test.check((select sum(c.amount_usd) from public.budget_categories c
                          join public.events e on e.id = c.event_id where e.is_on) = 15000,
                         'seed: active categories total $15,000');
  perform rls_test.check((select array_agg(key order by key) from public.budget_categories where is_locked)
                         = array['florals', 'lighting'], 'seed: florals and lighting are locked');
  perform rls_test.check((select count(*) from public.tasks) = 35, 'seed: 35 tasks');
  perform rls_test.check((select count(*) from public.tasks where is_done and done_by = rls_test.uid('nick')) = 3,
                         'seed: first three tasks done by Nick');
  perform rls_test.check((select due_date from public.tasks where sort = 3) = '2026-11-07',
                         'seed: 14.5 months before 2028-01-22 is 2026-11-07');
  perform rls_test.check((select count(*) from public.notes where type = 'decision'
                          and created_by = rls_test.uid('nick')) = 6, 'seed: six decision notes by Nick');
  perform rls_test.check((select role from public.members where user_id = rls_test.uid('nick')) = 'owner',
                         'Nick is an owner');

  insert into public.members (wedding_id, user_id, email, display_name, role) values
    (w, rls_test.uid('thuraya'), 'thuraya@rls-test.invalid', 'Thuraya', 'owner'),
    (w, rls_test.uid('planner'), 'planner@rls-test.invalid', 'Planner', 'planner');
end $$;

select rls_test.refused($$select public.setup_wedding('Again')$$, 'a second wedding can''t be set up');

-- ─── Planner: reads everything, but budget, payments, events, wedding and members are read-only ──

select rls_test.act_as('planner');

do $$
begin
  perform rls_test.check((select count(*) from public.weddings) = 1, 'planner reads the wedding');
  perform rls_test.check((select count(*) from public.budget_categories) = 16, 'planner reads the budget');
  perform rls_test.check((select count(*) from public.members) = 3, 'planner reads the members');

  perform rls_test.check(rls_test.affected($q$update public.budget_categories set amount_usd = 1$q$) = 0,
                         'planner can''t update budget_categories');
  perform rls_test.check(rls_test.affected($q$update public.budget_categories set is_locked = not is_locked$q$) = 0,
                         'planner can''t lock or unlock categories');
  perform rls_test.check(rls_test.affected($q$delete from public.budget_categories where not is_buffer$q$) = 0,
                         'planner can''t delete budget_categories');
  perform rls_test.check(rls_test.affected($q$update public.weddings set total_budget_usd = 99999$q$) = 0,
                         'planner can''t change the total budget');
  perform rls_test.check(rls_test.affected($q$update public.weddings set wedding_date = '2028-02-01'$q$) = 0,
                         'planner can''t change the wedding date');
  perform rls_test.check(rls_test.affected($q$update public.events set is_on = true$q$) = 0,
                         'planner can''t switch events on or off');
  perform rls_test.check(rls_test.affected($q$update public.members set role = 'owner'$q$) = 0,
                         'planner can''t promote themselves');
  perform rls_test.refused($q$insert into public.payments (wedding_id, label, amount_usd, due_date)
                              select id, 'x', 1, '2027-01-01' from public.weddings$q$,
                           'planner can''t add payments');
  perform rls_test.refused($q$insert into public.budget_categories (wedding_id, event_id, name)
                              select wedding_id, id, 'x' from public.events limit 1$q$,
                           'planner can''t add budget categories');
  perform rls_test.refused($q$insert into public.members (wedding_id, user_id, email, display_name, role)
                              select id, rls_test.uid('stranger'), 'x', 'x', 'owner' from public.weddings$q$,
                           'planner can''t invite people');
end $$;

reset role;
do $$ begin
  perform rls_test.check((select sum(amount_usd) from public.budget_categories) = 16800,
                         'budget untouched after the planner''s attempts');
  perform rls_test.check((select total_budget_usd from public.weddings) = 15000, 'total untouched');
end $$;
select rls_test.act_as('planner');

do $$
declare t uuid;
begin
  -- Tasks, vendors, guests, notes, ideas, dismissed suggestions are fully editable.
  insert into public.tasks (wedding_id, title, due_date)
    select id, 'Book the boat', '2027-06-01' from public.weddings returning id into t;
  update public.tasks set is_done = true where id = t;
  perform rls_test.check((select done_by from public.tasks where id = t) = rls_test.uid('planner'),
                         'ticking a task records the planner as done_by');
  perform rls_test.check(rls_test.affected(format('delete from public.tasks where id = %L', t)) = 1,
                         'planner can delete tasks');
  insert into public.vendors (wedding_id, name) select id, 'Florist' from public.weddings;
  insert into public.guests (wedding_id, name, party_size) select id, 'Rivera family', 4 from public.weddings;
  insert into public.notes (wedding_id, type, body, created_by)
    select id, 'question', 'Legal in Colombia?', rls_test.uid('nick') from public.weddings;
  perform rls_test.check((select created_by from public.notes where body = 'Legal in Colombia?')
                         = rls_test.uid('planner'), 'note author comes from the session, not the client');
  insert into public.ideas (wedding_id, kind, title, url)
    select id, 'link', 'Café lights', 'https://example.com/pin' from public.weddings;
  insert into public.dismissed_suggestions (wedding_id, suggestion_key) select id, 'hora' from public.weddings;

  -- No heart for the planner.
  perform rls_test.refused($q$insert into public.idea_votes (idea_id, user_id)
                              select id, rls_test.uid('planner') from public.ideas limit 1$q$,
                           'planner can''t heart ideas');
end $$;

-- ─── Owners: Thuraya edits the budget and hearts ideas, only as herself ────────────────────────

select rls_test.act_as('thuraya');

do $$
begin
  perform rls_test.check(rls_test.affected($q$update public.budget_categories set amount_usd = 2700 where key = 'venue'$q$) = 1,
                         'owner can update budget_categories');
  insert into public.idea_votes (idea_id, user_id) select id, rls_test.uid('thuraya') from public.ideas;
  perform rls_test.refused($q$insert into public.idea_votes (idea_id, user_id)
                              select id, rls_test.uid('nick') from public.ideas$q$,
                           'an owner can''t heart on someone else''s behalf');
  perform rls_test.refused($q$delete from public.budget_categories where is_buffer$q$,
                           'the buffer can''t be deleted');
end $$;

select rls_test.act_as('nick');
do $$
begin
  insert into public.idea_votes (idea_id, user_id) select id, rls_test.uid('nick') from public.ideas;
  perform rls_test.check(rls_test.affected(format('delete from public.idea_votes where user_id = %L', rls_test.uid('thuraya'))) = 0,
                         'an owner can''t remove someone else''s heart');
  perform rls_test.check((select count(*) from public.idea_votes) = 2, 'both hearts are there');
  perform rls_test.refused($q$delete from public.members where role = 'owner'$q$,
                           'a wedding can''t lose all its owners');
end $$;

-- ─── Storage: members use their wedding's folder; nobody else can ──────────────────────────────

do $$
begin
  insert into storage.objects (bucket_id, name)
    select 'inspiration', id || '/photo.jpg' from public.weddings;
  perform rls_test.refused($q$insert into storage.objects (bucket_id, name) values ('inspiration', 'not-a-wedding/photo.jpg')$q$,
                           'uploads outside a wedding folder are refused');
  perform rls_test.refused($q$insert into storage.objects (bucket_id, name)
                              values ('inspiration', gen_random_uuid() || '/photo.jpg')$q$,
                           'uploads into another wedding''s folder are refused');
end $$;

select rls_test.act_as('planner');
select rls_test.check((select count(*) from storage.objects) = 1, 'planner sees the wedding''s photos');

-- ─── A signed-in stranger sees nothing and changes nothing ─────────────────────────────────────

select rls_test.act_as('stranger');

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['weddings', 'members', 'events', 'budget_categories', 'payments', 'tasks', 'vendors',
                           'ideas', 'idea_votes', 'guests', 'notes', 'dismissed_suggestions']
  loop
    execute format('select count(*) from public.%I', t) into n;
    perform rls_test.check(n = 0, format('stranger reads nothing from %s', t));
  end loop;
  perform rls_test.check((select count(*) from storage.objects) = 0, 'stranger sees no files');
  perform rls_test.check(rls_test.affected($q$update public.tasks set title = 'x'$q$) = 0, 'stranger can''t edit tasks');
  perform rls_test.check(rls_test.affected($q$delete from public.weddings$q$) = 0, 'stranger can''t delete the wedding');
  perform rls_test.check(public.is_member((select id from public.weddings)) is not true, 'stranger is not a member');
end $$;

reset role;
do $$
declare w uuid := (select id from public.weddings);
begin
  perform rls_test.act_as('stranger');
  perform rls_test.refused(format($q$insert into public.tasks (wedding_id, title, due_date) values (%L, 'x', '2027-01-01')$q$, w),
                           'stranger can''t add tasks, even knowing the wedding id');
  perform rls_test.refused(format($q$insert into public.members (wedding_id, user_id, email, display_name, role)
                                     values (%L, %L, 'x', 'x', 'owner')$q$, w, rls_test.uid('stranger')),
                           'stranger can''t add themselves as a member');
  perform rls_test.refused(format($q$insert into storage.objects (bucket_id, name) values ('inspiration', %L)$q$, w || '/x.jpg'),
                           'stranger can''t upload into the wedding folder');
end $$;

-- ─── Signed-out visitors can't even query the tables ───────────────────────────────────────────

reset role;
select rls_test.act_as_anon();
select rls_test.refused($$select count(*) from public.weddings$$, 'anon can''t read weddings');
select rls_test.refused($$select count(*) from public.tasks$$, 'anon can''t read tasks');
select rls_test.refused($$select public.setup_wedding('x')$$, 'anon can''t set up a wedding');

reset role;
select 'All RLS checks passed' as result;

rollback;
