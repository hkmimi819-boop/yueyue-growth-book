-- 邀请码：注册必填，一码一次
-- 在 Supabase SQL Editor 中执行（新建项目可在 schema.sql 之后执行）

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  used boolean not null default false,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists invite_codes_code_idx on public.invite_codes (lower(code));
create index if not exists invite_codes_used_idx on public.invite_codes (used) where used = false;

alter table public.invite_codes enable row level security;

-- 禁止前端直接读写，仅通过下方函数校验/核销
-- 你在 Supabase Table Editor 用管理员身份插入邀请码即可

-- 注册前检查：未登录也可调用
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
    where code = lower(trim(p_code))
      and used = false
  );
$$;

-- 注册成功后核销：须已登录
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
  where code = lower(trim(p_code))
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

-- 示例：生成 5 个邀请码（可改 note 备注）
-- insert into public.invite_codes (code, note)
-- select
--   'bb-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
--   '批次-2026-05'
-- from generate_series(1, 5);
