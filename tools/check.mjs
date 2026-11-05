/** 本地静态检查：内链是否都能落到文件、样式/图片是否缺失 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === 'build' || e.name === 'tools') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
})(root);

let bad = 0, checked = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dir = path.dirname(f);
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(https?:|data:|mailto:|tel:|#|\/\/)/.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    checked++;
    let target = path.resolve(dir, clean);
    if (clean.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) {
      bad++;
      console.log('MISSING', path.relative(root, f), '->', ref);
    }
  }
}

// 简易标签配对检查（只查容易漏的块级标签）
const blocks = ['article', 'section', 'div', 'main', 'nav', 'header', 'footer', 'ul'];
let imbalance = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for (const tag of blocks) {
    const open = (html.match(new RegExp('<' + tag + '(?=[\\s>])', 'g')) || []).length;
    const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (open !== close) { imbalance++; console.log('TAG', path.relative(root, f), tag, open, '/', close); }
  }
}

console.log(`\n检查 ${files.length} 个页面，解析 ${checked} 个本地链接，缺失 ${bad} 处，标签不平衡 ${imbalance} 处`);
process.exit(bad + imbalance ? 1 : 0);
