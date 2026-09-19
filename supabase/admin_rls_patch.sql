-- Run once in Supabase SQL Editor after admin_users exists.
-- Uses the application's admin_users allowlist instead of app_metadata.role.

create or replace function public.is_funnel_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
      and enabled = true
      and role in ('admin', 'owner')
  );
$$;

revoke all on function public.is_funnel_admin() from public;
grant execute on function public.is_funnel_admin() to authenticated;

create or replace function public.upsert_funnel_analytics(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_funnel_admin() then
    raise exception 'admin access required';
  end if;

  insert into public.funnel_analytics (id, data, updated_at)
  values (1, p_data, now())
  on conflict (id) do update
    set data = excluded.data, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.upsert_funnel_analytics(jsonb) from public;
grant execute on function public.upsert_funnel_analytics(jsonb) to authenticated;

create or replace function public.reset_funnel_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_funnel_admin() then
    raise exception 'admin access required';
  end if;
  -- Chỉ reset số liệu lượt truy cập, KHÔNG đụng tới bảng leads (CRM); muốn xóa lead hãy dùng clear_funnel_leads().
  delete from public.visitor_sessions where true;
  insert into public.funnel_analytics (id, data, updated_at)
  values (1, '{"visits":0,"leads":0,"bySource":{},"bySourceStats":{},"byVariant":{}}'::jsonb, now())
  on conflict (id) do update
    set data = excluded.data, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.reset_funnel_analytics() from public;
grant execute on function public.reset_funnel_analytics() to authenticated;

create or replace function public.clear_funnel_leads()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_funnel_admin() then
    raise exception 'admin access required';
  end if;
  delete from public.leads where true;
end;
$$;
revoke all on function public.clear_funnel_leads() from public;
grant execute on function public.clear_funnel_leads() to authenticated;

drop policy if exists "funnel analytics can be written" on public.funnel_analytics;
drop policy if exists "funnel analytics can be updated" on public.funnel_analytics;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'funnel_analytics'
      and cmd in ('INSERT', 'UPDATE', 'ALL', 'a', 'w', '*')
  loop
    execute format(
      'drop policy if exists %I on public.funnel_analytics',
      policy_record.policyname
    );
  end loop;
end
$$;

create policy "funnel analytics can be written"
  on public.funnel_analytics for insert
  to authenticated
  with check (
    id = 1
    and public.is_funnel_admin()
  );
create policy "funnel analytics can be updated"
  on public.funnel_analytics for update
  to authenticated
  using (
    id = 1
    and public.is_funnel_admin()
  )
  with check (
    id = 1
    and public.is_funnel_admin()
  );

-- Ensure the aggregate row exists for the Admin analytics screen.
insert into public.funnel_analytics (id, data, updated_at)
values (
  1,
  '{"visits":0,"leads":0,"bySource":{},"bySourceStats":{},"byVariant":{}}'::jsonb,
  now()
)
on conflict (id) do nothing;
