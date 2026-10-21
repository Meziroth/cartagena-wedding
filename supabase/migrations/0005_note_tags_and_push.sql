-- Note tags and phone notifications.

-- ─── Tags on notes ─────────────────────────────────────────────────────────────────────────────
-- Free-form tags the couple and planner make up as they go. Up to 10 per note, each up to 30 characters.
alter table public.notes add column tags text[] not null default '{}';

create function public.valid_tags(t text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(t) <= 10
     and not exists (select 1 from unnest(t) x where length(trim(x)) not between 1 and 30)
$$;
alter table public.notes add constraint notes_tags_valid check (public.valid_tags(tags));
create index notes_tags_idx on public.notes using gin (tags);

-- ─── Push subscriptions ────────────────────────────────────────────────────────────────────────
-- One row per device that turned notifications on. `kinds` is what that device wants to hear about.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%'),
  p256dh     text not null,
  auth       text not null,
  kinds      text[] not null default array['note_created', 'note_edited', 'idea_added', 'task_done']
               check (kinds <@ array['note_created', 'note_edited', 'idea_added', 'task_done']),
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_wedding_idx on public.push_subscriptions (wedding_id);
create trigger set_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

-- People see and manage only their own devices. Sending happens in the notify Edge Function (service role).
create policy "own devices read" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy "own devices update" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(wedding_id));
create policy "own devices delete" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- Saving goes through this function: a shared phone or browser may still hold someone else's subscription for
-- the same endpoint (say, after they signed out elsewhere), and it now belongs to whoever turned it on last.
create function public.save_push_subscription(
  p_wedding uuid, p_endpoint text, p_p256dh text, p_auth text, p_kinds text[], p_user_agent text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_member(p_wedding) then
    raise exception 'Only people in the wedding can turn on notifications.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> auth.uid();
  insert into public.push_subscriptions (user_id, wedding_id, endpoint, p256dh, auth, kinds, user_agent)
  values (auth.uid(), p_wedding, p_endpoint, p_p256dh, p_auth, p_kinds, left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set wedding_id = excluded.wedding_id, p256dh = excluded.p256dh, auth = excluded.auth,
        kinds = excluded.kinds, user_agent = excluded.user_agent;
end $$;

revoke execute on function public.save_push_subscription(uuid, text, text, text, text[], text) from public, anon;
grant execute on function public.save_push_subscription(uuid, text, text, text, text[], text) to authenticated;
