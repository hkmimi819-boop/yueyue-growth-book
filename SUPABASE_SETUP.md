# 宝宝成长记录本 · Supabase 配置指南

按顺序完成下面 **8 步**。每步做完再打勾，全部完成后即可使用邮箱登录、云端同步与加密存储。

---

## 第 1 步：注册 Supabase 并创建项目

1. 打开 [https://supabase.com](https://supabase.com)，用 GitHub 或邮箱注册。
2. 登录后点击 **New Project**。
3. 填写：
   - **Name**：例如 `baby-growth-book`
   - **Database Password**：生成强密码并**保存到密码管理器**（以后很少用到，但重置数据库时需要）
   - **Region**：选离你最近的（中国用户可选 `Southeast Asia (Singapore)`）
4. 点击 **Create new project**，等待约 1–2 分钟直到状态为绿色 **Active**。

---

## 第 2 步：开启邮箱注册与登录

1. 左侧菜单 **Authentication** → **Providers**。
2. 确认 **Email** 已开启（默认开启）。
3. 点击 **Email**，建议设置：
   - **Enable Email Signup**：开启（允许注册）
   - **Confirm email**：开发阶段可先**关闭**，方便测试；上线前再开启
4. 点击 **Save**。

> 家人共享：全家人使用**同一个邮箱和密码**登录即可看到同一份数据（一个账号 = 一个家庭）。

---

## 第 3 步：创建数据库表与安全策略

1. 左侧 **SQL Editor** → **New query**。
2. 打开本项目中的 `supabase/schema.sql`，**全选复制**全部内容。
3. 粘贴到 Supabase SQL 编辑器，点击 **Run**（或 Ctrl+Enter）。
4. 底部应显示 **Success**，无红色报错。

这一步会创建：

| 表名 | 作用 |
|------|------|
| `profiles` | 每个用户的加密盐（用于密钥派生） |
| `family_records` | 加密后的家庭成长数据（JSON 密文） |

并启用 **RLS（行级安全）**：用户只能读写 `auth.uid()` 等于自己的行，**家庭之间完全隔离**。

---

## 第 4 步：获取 API 密钥

1. 左侧 **Project Settings**（齿轮）→ **API**。
2. 复制并暂存到记事本：
   - **Project URL**（形如 `https://xxxxx.supabase.co`）
   - **anon public** 密钥（`eyJ...` 开头，可放在前端）

> ⚠️ **不要**把 `service_role` 密钥写进网页或提交到 Git，它可绕过所有安全策略。

---

## 第 5 步：在本地配置 `config.js`

1. 在项目目录 `baby-growth-book/` 下，复制示例文件：

   ```bash
   cp config.example.js config.js
   ```

2. 用编辑器打开 `config.js`，填入第 4 步复制的值：

   ```javascript
   window.SUPABASE_CONFIG = {
     url: 'https://你的项目ID.supabase.co',
     anonKey: '你的 anon public 密钥',
   };
   ```

3. 确认 `config.js` 已在 `.gitignore` 中（已配置，不会误提交密钥）。

---

## 第 6 步：本地运行并注册第一个家庭账号

1. 在项目目录启动本地服务器（任选一种）：

   ```bash
   cd baby-growth-book
   python3 -m http.server 8080
   ```

2. 浏览器打开：`http://localhost:8080`
3. 应看到**登录 / 注册**界面。
4. 点击 **注册**，填写家庭共用的邮箱和密码（建议 8 位以上，含字母与数字）。
5. 注册成功后会自动登录并进入记录本。

若之前用浏览器存过本地数据，会提示**是否合并到云端**，选「合并」即可。

---

## 第 7 步：验证隔离与加密（可选但推荐）

### 7.1 验证家庭隔离

1. 再注册一个**不同邮箱**的测试账号。
2. 在账号 A 添加一条身高记录。
3. 退出登录，用账号 B 登录 → 应看不到账号 A 的数据。

### 7.2 验证数据库中是密文

1. Supabase 控制台 → **Table Editor** → `family_records`。
2. 查看 `encrypted_data` 列：应是长串 Base64 乱码，**不是**可读的 JSON。

说明：加密在浏览器内完成，密钥由登录密码派生，Supabase 只存密文。

---

## 第 8 步：部署到 Vercel（分享给家人）

你的 GitHub 仓库：`https://github.com/hkmimi819-boop/yueyue-growth-book`

1. 登录 [vercel.com](https://vercel.com) → **Add New Project** → 导入上述仓库。
2. **Root Directory** 留空（仓库根目录即网页）。
3. 展开 **Environment Variables**，添加两条（Production / Preview 都勾选）：

   | 名称 | 值 |
   |------|-----|
   | `SUPABASE_URL` | 第 4 步复制的 Project URL |
   | `SUPABASE_ANON_KEY` | 第 4 步复制的 anon public 密钥 |

4. 点击 **Deploy**。构建脚本会自动生成 `config.js`（无需把密钥提交到 Git）。
5. 部署完成后，在 Supabase **Authentication** → **URL Configuration**：
   - **Site URL**：`https://你的项目.vercel.app`
   - **Redirect URLs**：添加同一地址（用于忘记密码邮件链接）
6. 把 Vercel 网址发给家人，用**同一邮箱和密码**登录即可同步数据。

---

## 常见问题

### 注册后提示「无法连接」

- 检查 `config.js` 的 `url`、`anonKey` 是否完整、无多余空格。
- 必须用 `http://localhost` 或 `https://` 打开，不要直接双击 `index.html`（`file://` 会导致跨域问题）。

### 邮件确认链接打不开

- 开发阶段在 Supabase 关闭 **Confirm email**（第 2 步）。
- 或在 **Authentication** → **Users** 里手动确认用户。

### 换设备后数据没了

- 必须用**同一邮箱密码**登录。
- 确认登录后右上角显示该邮箱。

### 忘记密码

- 登录页点击 **忘记密码**，按邮件重置（需在 Supabase 配置 SMTP 或使用 Supabase 默认邮件，有每日限额）。

---

## 安全说明（给你和家人看的）

| 能力 | 实现方式 |
|------|----------|
| 邮箱 + 密码登录 | Supabase Auth |
| 云端数据库 | Supabase PostgreSQL |
| 家庭数据隔离 | RLS：仅 `auth.uid()` 可访问自己的行 |
| 家人共享 | 共用同一 Supabase 账号登录 |
| 加密存储 | 浏览器 AES-256-GCM，密钥由密码 + 盐派生 |

**请注意**：加密密钥在登录时由密码生成。若忘记密码并重置，**旧密文无法解密**，需在重置前导出数据，或记住原密码。这是端到端加密类产品的通用限制。

---

## 生产环境进阶（可选）

- 开启 **Confirm email** 与自定义 SMTP（SendGrid、阿里云邮件等）。
- 在 Supabase **Database** → **Backups** 确认自动备份已开启。
- 定期在应用内「导出数据」备份（后续可加导出按钮）。

---

完成以上步骤后，告诉我你进行到哪一步、卡在哪一步，我可以继续帮你排查。
