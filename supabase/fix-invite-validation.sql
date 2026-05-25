-- 修复邀请码校验：大小写不敏感 + 统一存量邀请码为小写
-- 在 Supabase SQL Editor 执行（invite-codes.sql 已执行过也可再执行本文件）

-- 1. 存量邀请码统一为小写（避免 BB-XXX 与 bb-xxx 不匹配）
update public.invite_codes
set code = lower(trim(code))
where code is not null;

-- 2. 写入时自动转小写
create or replace function public.invite_codes_normalize_code()
returns trigger
language plpgsql
as $$
begin
  new.code := lower(trim(new.code));
  return new;
end;
$$;

drop trigger if exists invite_codes_normalize on public.invite_codes;
create trigger invite_codes_normalize
before insert or update of code on public.invite_codes
for each row execute function public.invite_codes_normalize_code();

-- 3. 校验 / 核销：两边都 lower，避免大小写问题
create or replace function public.check_invite_code(p_code text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.invite_codes
    where lower(trim(code)) = lower(trim(p_code))
      and used = false
  );
$$;

create or replace function public.redeem_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.invite_codes
  set
    used = true,
    used_at = timezone('utc', now()),
    used_by = auth.uid()
  where lower(trim(code)) = lower(trim(p_code))
    and used = false;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.check_invite_code(text) from public;
revoke all on function public.redeem_invite_code(text) from public;
grant execute on function public.check_invite_code(text) to anon;
grant execute on function public.check_invite_code(text) to authenticated;
grant execute on function public.redeem_invite_code(text) to authenticated;
