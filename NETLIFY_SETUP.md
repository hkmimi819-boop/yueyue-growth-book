# Netlify 部署 · 连接 Supabase

`config.js` 含密钥，**不会**提交到 GitHub。Netlify 在**每次部署构建时**用环境变量自动生成。

---

## 第 1 步：在 Netlify 添加环境变量

1. 打开 [Netlify Dashboard](https://app.netlify.com) → 你的站点  
2. **Site configuration** → **Environment variables** → **Add a variable**  
3. 添加两条（**Production** 务必勾选）：

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | `https://fwveyvxivoebhlnznuww.supabase.co` |
| `SUPABASE_ANON_KEY` | 你的 anon public 密钥（`eyJ` 开头） |

4. 保存

---

## 第 2 步：确认构建设置

项目根目录已有 `netlify.toml`：

- **Build command**: `node scripts/write-config.js`
- **Publish directory**: `.`（当前目录）

在 Netlify **Site configuration** → **Build & deploy** → **Build settings** 中，应显示为上述内容（或「从 netlify.toml 读取」）。

---

## 第 3 步：重新部署

1. **Deploys** → **Trigger deploy** → **Deploy site**  
2. 打开 **Deploy log**，应看到：`✓ config.js 已生成`  
3. 若失败并提示缺少环境变量，回到第 1 步检查变量名是否完全一致  

---

## 第 4 步：Supabase 允许你的 Netlify 域名

1. [Supabase Dashboard](https://supabase.com/dashboard) → 项目 **yueyue-growth-book**  
2. **Authentication** → **URL Configuration**  
3. 填写：
   - **Site URL**: `https://你的站点名.netlify.app`  
   - **Redirect URLs**: 同上（用于忘记密码等）  
4. **Save**

---

## 第 5 步：验证

1. 浏览器打开 Netlify 网址  
2. 应出现 **登录 / 注册**（不是「config.js 未加载」）  
3. 用家庭账号登录，添加一条记录  
4. 底部/右上角出现 **「已同步到 Supabase 云端」**  

---

## 本地开发

本地仍使用自己的 `config.js`（不提交 Git）：

```bash
cp config.example.js config.js
# 填入 URL 和 anon key
python3 -m http.server 8080
```

---

## 常见问题

### 仍显示「config.js 未加载」

- 未配置环境变量就部署 → 按第 1 步添加后 **重新 Deploy**  
- 浏览器缓存 → 无痕窗口或强制刷新  

### 构建日志没有「config.js 已生成」

- Build command 被 Netlify UI 覆盖为空 → 清空自定义 build，改用 `netlify.toml`  

### 本地正常、Netlify 不行

- 99% 是环境变量未设或拼写错误（必须叫 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`）
