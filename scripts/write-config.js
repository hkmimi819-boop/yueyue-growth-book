#!/usr/bin/env node
/**
 * Vercel 构建时从环境变量生成 config.js
 * 在 Vercel 项目设置中添加：
 *   SUPABASE_URL、SUPABASE_ANON_KEY
 */
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

const out = `window.SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};
`;

const target = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(target, out, 'utf8');
console.log('config.js generated:', url ? 'OK' : 'WARN: SUPABASE_URL empty');
