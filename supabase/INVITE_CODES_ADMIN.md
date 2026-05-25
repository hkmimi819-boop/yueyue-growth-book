# 邀请码管理（后台）

注册时必须填写有效邀请码，**每个码仅可使用一次**。

---

## 1. 首次启用：执行 SQL

在 Supabase **SQL Editor** 运行项目中的：

`supabase/invite-codes.sql`

---

## 2. 生成邀请码

在 **SQL Editor** 执行（一次生成 10 个，可自行改数量）：

```sql
insert into public.invite_codes (code, note)
select
  'bb-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  '发放批次-2026-05'
from generate_series(1, 10)
returning code, note;
```

`returning` 会列出刚生成的码，复制发给用户。

### 指定单个邀请码

```sql
insert into public.invite_codes (code, note)
values ('bb-gift-xiaoming', '送给小明一家');
```

邀请码**不区分大小写**（系统自动转成小写保存）。

若注册提示邀请码无效，请在 SQL Editor 执行 **`fix-invite-validation.sql`** 修复大小写匹配。

---

## 3. 在后台查看与管理

**Table Editor** → `invite_codes`

| 字段 | 说明 |
|------|------|
| `code` | 邀请码 |
| `used` | 是否已使用 |
| `used_by` | 使用该码注册的用户 ID |
| `used_at` | 使用时间 |
| `note` | 你的备注（发给谁） |

---

## 4. 作废 / 恢复邀请码

**未使用的码** — 直接删除行：

```sql
delete from public.invite_codes
where code = 'bb-xxxx' and used = false;
```

**误核销后恢复**（慎用，仅当注册失败需重发）：

```sql
update public.invite_codes
set used = false, used_by = null, used_at = null
where code = 'bb-xxxx';
```

---

## 5. 统计

```sql
select
  count(*) filter (where not used) as 未使用,
  count(*) filter (where used) as 已使用
from public.invite_codes;
```
