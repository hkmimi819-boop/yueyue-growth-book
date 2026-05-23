-- 一键确认邮箱（不用点 Authentication 菜单）
-- 用法：把下面邮箱改成你注册时用的邮箱，在 SQL Editor 里 Run

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmed_at = COALESCE(confirmed_at, now())
WHERE email = '你的邮箱@example.com';

-- 执行后应显示 Success，且 "UPDATE 1" 表示已确认 1 个用户
