-- Changes that touch many rows at once, so they happen together or not at all (Phase 4).
-- Both run as the caller (security invoker), so the usual RLS rules decide who may make them.

-- Saves a new total and the category amounts the flex rule produced, in one step.
-- p_amounts maps category id → whole USD, e.g. {"<uuid>": 2400, …}. p_total null leaves the total alone.
create function public.save_budget(p_wedding uuid, p_total integer, p_amounts jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  n integer;
begin
  if not public.is_owner(p_wedding) then
    raise exception 'Only Nick and Thuraya can change the budget.' using errcode = 'insufficient_privilege';
  end if;

  if p_total is not null then
    update public.weddings set total_budget_usd = p_total where id = p_wedding;
  end if;

  update public.budget_categories c
     set amount_usd = (a.value)::integer
    from jsonb_each_text(coalesce(p_amounts, '{}'::jsonb)) a
   where c.wedding_id = p_wedding and c.id = (a.key)::uuid and c.amount_usd is distinct from (a.value)::integer;

  select count(*) into n
    from jsonb_object_keys(coalesce(p_amounts, '{}'::jsonb)) k
   where not exists (select 1 from public.budget_categories c where c.wedding_id = p_wedding and c.id = k::uuid);
  if n > 0 then
    raise exception 'Some budget categories were deleted in the meantime. Reload and try again.' using errcode = 'no_data_found';
  end if;
end $$;

-- Moves the wedding date and shifts every task's due date by the same number of days.
create function public.set_wedding_date(p_wedding uuid, p_date date)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_old date;
begin
  if not public.is_owner(p_wedding) then
    raise exception 'Only Nick and Thuraya can change the wedding date.' using errcode = 'insufficient_privilege';
  end if;

  select wedding_date into v_old from public.weddings where id = p_wedding for update;
  if v_old is null or v_old = p_date then
    return;
  end if;

  update public.weddings set wedding_date = p_date where id = p_wedding;
  update public.tasks set due_date = due_date + (p_date - v_old) where wedding_id = p_wedding;
end $$;

revoke execute on function public.save_budget(uuid, integer, jsonb), public.set_wedding_date(uuid, date) from public, anon;
grant execute on function public.save_budget(uuid, integer, jsonb), public.set_wedding_date(uuid, date) to authenticated;
