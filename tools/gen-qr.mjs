#!/usr/bin/env node
/**
 * 生成分享用的静态二维码（每篇文章一份 + 站点一份）
 * - 输出：a/<id>/qr.svg、assets/qr-site.svg
 * - 只在内容或域名变化时手动跑一次；build.mjs 不会覆盖已有二维码
 * - 依赖 qrcode 库：默认从 ../domtest/node_modules 找，也可以用 QRCODE_PATH 指定
 *
 * 用法：node tools/gen-qr.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadQR() {
  const candidates = [
    process.env.QRCODE_PATH,
    'qrcode',
    'C:/domtest/node_modules/qrcode',
    path.join(ROOT, 'node_modules/qrcode')
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (e) {}
  }
  throw new Error('找不到 qrcode 库，先执行：npm i qrcode（或设置 QRCODE_PATH）');
}

const QR = loadQR();
const { GUIDES } = require(path.join(ROOT, 'assets/data.js'));
/* 站点根地址：默认新域名，可用 SITE_URL 覆盖，换域名时只改这一处 */
const SITE = (process.env.SITE_URL || 'https://wgame-bc7.pages.dev/').replace(/\/+$/, '') + '/';

const OPTS = {
  type: 'svg',
  margin: 1,
  width: 148,
  errorCorrectionLevel: 'M',
  color: { dark: '#0d0f1a', light: '#ffffff' }
};

async function write(url, out) {
  const svg = await QR.toString(url, OPTS);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, svg.trim() + '\n', 'utf8');
  return fs.statSync(out).size;
}

let bytes = 0, n = 0;
for (const gi of GUIDES) {
  const out = path.join(ROOT, 'a', gi.id, 'qr.svg');
  bytes += await write(SITE + 'a/' + gi.id + '/', out);
  n++;
}
bytes += await write(SITE, path.join(ROOT, 'assets/qr-site.svg'));
n++;

console.log(`已生成 ${n} 个二维码（${(bytes / 1024).toFixed(1)} KB）：${GUIDES.length} 篇攻略 + 站点首页`);
