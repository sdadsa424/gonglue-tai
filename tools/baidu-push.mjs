/* 百度主动推送（普通收录 API）：拿到 token 后一次性推全站
   用法：node tools/baidu-push.mjs <token>
   说明：
     - site 用协议+域名，必须与搜索资源平台里验证过的站点完全一致
     - 每天配额有限（新站通常 10~100 条），返回 remain 是当天剩余额度
     - 推送只是「告知」，是否收录仍看内容质量与抓取情况 */
import fs from 'node:fs';

const token = process.argv[2];
if (!token) { console.error('用法：node tools/baidu-push.mjs <token>'); process.exit(1); }

const SITE = 'https://wgame-bc7.pages.dev';
const sm = fs.readFileSync('sitemap.xml', 'utf8');
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
console.log('待推送 ' + urls.length + ' 条');

const res = await fetch('http://data.zz.baidu.com/urls?site=' + encodeURIComponent(SITE) + '&token=' + encodeURIComponent(token), {
  method: 'POST',
  headers: { 'content-type': 'text/plain' },
  body: urls.join('\n')
});
const text = await res.text();
console.log('HTTP ' + res.status + ' ' + text);
