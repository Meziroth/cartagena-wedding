-- Sign-in helpers (Phase 3).

-- After sign-in, someone with no members row either sets up the wedding (nobody has yet) or waits for an
-- invitation. RLS hides the weddings table from non-members, so this answers the one question they need.
-- It reveals only whether a wedding exists, and only to signed-in users.
create function public.can_set_up_wedding() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not exists (select 1 from public.weddings)
$$;

revoke execute on function public.can_set_up_wedding() from public, anon;
grant execute on function public.can_set_up_wedding() to authenticated;
