/* IndexNow 主动提交：把 sitemap 里所有 URL 推给 Bing / Yandex 等参与方
   用法：node tools/indexnow.mjs [--dry]
   依赖：根目录存在 <key>.txt（内容即 key），且站点已部署可访问 */
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://wgame-bc7.pages.dev';
const keyFile = fs.readdirSync('.').find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error('找不到 IndexNow key 文件（32 位十六进制 .txt）'); process.exit(1); }
const key = fs.readFileSync(keyFile, 'utf8').trim();

const sm = fs.readFileSync('sitemap.xml', 'utf8');
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
if (!urls.length) { console.error('sitemap 里没有 URL'); process.exit(1); }
console.log('待提交 ' + urls.length + ' 条，key=' + key);

if (process.argv.includes('--dry')) { urls.forEach(u => console.log('  ' + u)); process.exit(0); }

const body = {
  host: new URL(SITE).host,
  key,
  keyLocation: SITE + '/' + keyFile,
  urlList: urls
};

const t0 = Date.now();
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});
const text = (await res.text()).slice(0, 300);
console.log('HTTP ' + res.status + ' (' + (Date.now() - t0) + 'ms) ' + text);
console.log(res.status === 200 || res.status === 202
  ? '已受理：Bing / Yandex 会在数小时内抓取新链接'
  : '未受理：检查 key 文件是否已部署可访问、host 与 sitemap 域名是否一致');
