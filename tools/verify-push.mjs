import fs from 'fs';
import { execSync } from 'child_process';
const tree = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const map = {};
(tree.tree || []).forEach(e => { if (e.type === 'blob') map[e.path] = e.sha; });
const files = `index.html 404.html sitemap.xml robots.txt feed.xml sw.js board/index.html assets/data.js assets/dates.js g/tljsc/index.html a/tljsc-intro/index.html a/tljsc-intro/qr.svg a/tljsc-cls/index.html a/tljsc-cls/qr.svg a/tljsc-level/index.html a/tljsc-level/qr.svg a/tljsc-element/index.html a/tljsc-element/qr.svg assets/tljsc-hero.jpg assets/tljsc-hero.webp assets/tljsc-hero.avif assets/tljsc-feat-1.jpg assets/tljsc-feat-1.webp assets/tljsc-feat-1.avif assets/tljsc-feat-2.jpg assets/tljsc-feat-2.webp assets/tljsc-feat-2.avif assets/tljsc-feat-3.jpg assets/tljsc-feat-3.webp assets/tljsc-feat-3.avif assets/tljsc-shot-1.jpg assets/tljsc-shot-1.webp assets/tljsc-shot-1.avif assets/tljsc-icon.jpg assets/tljsc-icon.webp assets/tljsc-icon.avif`.split(' ');
let bad = 0;
for (const f of files) {
  const l = execSync(`git hash-object "${f}"`).toString().trim();
  if (map[f] !== l) { console.log('MISMATCH', f, map[f] || 'MISSING'); bad++; }
}
console.log(bad ? bad + ' 个不一致' : '全部 ' + files.length + ' 个文件远端哈希一致');
