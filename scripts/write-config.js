#!/usr/bin/env node
/**
 * 部署构建时从环境变量生成 config.js（Netlify / Vercel 通用）
 *
 * 环境变量：
 *   SUPABASE_URL      — Project URL
 *   SUPABASE_ANON_KEY — anon public 密钥
 */
const fs = require('fs');
const path = require('path');

const url = (process.env.SUPABASE_URL || '').trim();
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

const isNetlify = process.env.NETLIFY === 'true';
const isVercel = Boolean(process.env.VERCEL);
const isCi = Boolean(process.env.CI);

if ((isNetlify || isVercel || isCi) && (!url || !anonKey)) {
  console.error(
    '\n❌ 缺少环境变量 SUPABASE_URL 或 SUPABASE_ANON_KEY\n' +
      'Netlify: Site configuration → Environment variables\n' +
      'Vercel:  Project Settings → Environment Variables\n'
  );
  process.exit(1);
}

const out = `// 由 scripts/write-config.js 在部署时自动生成，请勿手动编辑
window.SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};
`;

const target = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(target, out, 'utf8');

if (url && anonKey) {
  console.log('✓ config.js 已生成（Supabase URL:', url.slice(0, 30) + '…）');
} else {
  console.warn('⚠ config.js 已生成但环境变量为空（仅适合本地已有 config.js 时）');
}
