#!/usr/bin/env node
/* 全站体检：链接 / 图片 / SEO / 结构 / 体积
 * 用法：node tools/audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE = 'https://wgame-bc7.pages.dev';
const SKIP = new Set(['node_modules', '.git', '.workbuddy', 'build', 'tools', 'functions']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const all = walk(ROOT);
const pages = all.filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

const issues = { brokenLink: [], noAlt: [], dupId: [], title: [], desc: [], h1: [], canonical: [], imgSize: [], noLang: [], jsonld: [], bigImg: [] };

// base = 引用所在页面目录（相对站点根），用于解析相对路径
const existsLocal = (p, base = '') => {
  const clean = p.split('#')[0].split('?')[0];
  if (!clean) return true;
  if (/^(https?:|mailto:|tel:|javascript:|data:)/.test(clean)) return true;
  let target = clean.startsWith('/') ? clean.slice(1) : path.posix.join(base, clean);
  target = path.posix.normalize(target);
  if (target.endsWith('/')) target += 'index.html';
  if (target === '' || target === '.') target = 'index.html';
  return fs.existsSync(path.join(ROOT, decodeURIComponent(target)));
};

const attr = (tag, name) => {
  const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i'));
  return m ? m[1] : null;
};

for (const f of pages) {
  const r = rel(f);
  const html = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(r);

  // lang
  if (!/<html[^>]+lang=/.test(html)) issues.noLang.push(r);

  // title / description
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
  if (title.length > 34) issues.title.push(`${r} (${title.length}) ${title}`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (!desc) issues.desc.push(`${r} 缺描述`);
  else if (desc.length > 105) issues.desc.push(`${r} (${desc.length})`);

  // h1
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) issues.h1.push(`${r} h1 x${h1s.length}`);

  // canonical（noindex 页不需要，也不该有）
  const noindex = /<meta name="robots" content="[^"]*noindex/i.test(html);
  const can = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
  if (!can) {
    if (!noindex) issues.canonical.push(`${r} 无 canonical`);
  } else {
    const expect = r === 'index.html' ? `${SITE}/` : `${SITE}/${dir}/`;
    if (can !== expect) issues.canonical.push(`${r} → ${can}（应为 ${expect}）`);
  }

  // links
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(data:|javascript:|#)/.test(u)) continue;
    if (/['"+]/.test(u)) continue;              /* 内联脚本里的模板拼接，不是真链接 */
    if (!existsLocal(u, dir === '.' ? '' : dir)) issues.brokenLink.push(`${r} → ${u}`);
  }

  // img alt + width/height
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (attr(tag, 'alt') === null) issues.noAlt.push(`${r} ${attr(tag, 'src') || ''}`);
    if (!attr(tag, 'width') || !attr(tag, 'height')) issues.imgSize.push(`${r} ${attr(tag, 'src') || ''}`);
  }

  // duplicate ids
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set(), dup = new Set();
  for (const id of ids) { if (seen.has(id)) dup.add(id); seen.add(id); }
  if (dup.size) issues.dupId.push(`${r} → ${[...dup].join(',')}`);

  // json-ld
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { issues.jsonld.push(r); }
  }
}

// 大图（>300KB 的 jpg/png）
for (const f of all.filter((x) => /\.(jpg|png|jpeg)$/i.test(x))) {
  const kb = fs.statSync(f).size / 1024;
  if (kb > 400) issues.bigImg.push(`${rel(f)} ${Math.round(kb)}KB`);
}

const print = (name, arr, limit = 12) => {
  const label = arr.length ? `✗ ${name}: ${arr.length}` : `✓ ${name}`;
  console.log(label);
  arr.slice(0, limit).forEach((x) => console.log('   · ' + x));
  if (arr.length > limit) console.log(`   … 另 ${arr.length - limit} 条`);
};

console.log(`扫描 ${pages.length} 个 HTML 页面\n`);
print('死链 / 缺失资源', issues.brokenLink);
print('img 缺 alt', issues.noAlt);
print('img 缺宽高（会抖动）', issues.imgSize);
print('重复 id', issues.dupId);
print('title 过长（>34 字）', issues.title);
print('description 缺失/过长', issues.desc);
print('h1 数量异常', issues.h1);
print('canonical 异常', issues.canonical);
print('html 缺 lang', issues.noLang);
print('JSON-LD 解析失败', issues.jsonld);
print('大图 >300KB', issues.bigImg);

// sitemap 交叉校验
const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const missing = locs.filter((u) => !existsLocal(u.replace(SITE, ''), ''));
console.log(`\nsitemap ${locs.length} 条${missing.length ? `，本地缺 ${missing.length}: ${missing.slice(0, 5).join(' ')}` : '，全部命中本地页面'}`);

const total = Object.values(issues).reduce((a, b) => a + b.length, 0);
console.log(`\n合计问题：${total}`);
