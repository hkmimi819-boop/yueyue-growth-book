-- 宝宝成长记录本 · Supabase 数据库结构
-- 可重复执行（已存在的表/策略会先删除再创建）

-- 用户配置（加密盐，每账号一份）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  encryption_salt text not null,
  baby_name text default '宝宝',
  created_at timestamptz not null default now()
);

-- 家庭成长数据（整包 JSON 加密后存入）
create table if not exists public.family_records (
  user_id uuid primary key references auth.users (id) on delete cascade,
  encrypted_data text not null default '',
  updated_at timestamptz not null default now()
);

-- 启用行级安全 RLS
alter table public.profiles enable row level security;
alter table public.family_records enable row level security;

-- 删除旧策略（若已存在）
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "family_records_select_own" on public.family_records;
drop policy if exists "family_records_insert_own" on public.family_records;
drop policy if exists "family_records_update_own" on public.family_records;
drop policy if exists "family_records_delete_own" on public.family_records;

-- profiles：仅本人可读写
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- family_records：仅本人可读写
create policy "family_records_select_own"
  on public.family_records for select
  using (auth.uid() = user_id);

create policy "family_records_insert_own"
  on public.family_records for insert
  with check (auth.uid() = user_id);

create policy "family_records_update_own"
  on public.family_records for update
  using (auth.uid() = user_id);

create policy "family_records_delete_own"
  on public.family_records for delete
  using (auth.uid() = user_id);

-- 自动更新 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists family_records_updated_at on public.family_records;
create trigger family_records_updated_at
  before update on public.family_records
  for each row execute function public.set_updated_at();
