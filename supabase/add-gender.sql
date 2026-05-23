-- 已有项目执行本文件，为 profiles 增加性别字段
alter table public.profiles
  add column if not exists baby_gender text default 'boy';

alter table public.profiles
  drop constraint if exists profiles_baby_gender_check;

alter table public.profiles
  add constraint profiles_baby_gender_check
  check (baby_gender in ('boy', 'girl'));

update public.profiles
set baby_gender = 'boy'
where baby_gender is null;
