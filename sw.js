/* 游戏攻略大全 · 离线缓存 Service Worker
 * 由 build/build.mjs 从本模板生成根目录 sw.js，下方 VERSION 会被替换成资源指纹：
 * 内容一变版本就变，旧的整仓缓存随之清掉，不会出现「改了样式但用户还看旧版」。
 *
 * 策略：
 *   导航请求（HTML）  network-first —— 有网永远拿最新的，断网退回缓存，再退回离线页
 *   静态资源          stale-while-revalidate —— 先给缓存（秒开），后台静默更新
 *   接口 /api/*       完全不拦——点赞、留言必须实时，不能被缓存糊住
 *   跨域请求（天气/IP/统计）不拦——交给浏览器
 */
const VERSION = 'c9480720ca';
const CACHE = 'gl-' + VERSION;
/* 部署在子路径（如 GitHub Pages 的 /gonglue-tai/）时，scope 就是子路径根 */
const ROOT = self.registration.scope;
const abs = p => new URL(p, ROOT).href;

const CORE = [
  '',
  'assets/style.css',
  'assets/ui.js',
  'assets/data.js',
  'assets/dates.js',
  'assets/icon-192.png',
  'assets/manifest.webmanifest',
  'favicon.ico',
  /* Cloudflare Pages 会把 /offline.html 308 到 /offline，两条都收，谁通用谁 */
  'offline',
  'offline.html',
  'board/'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      /* 逐个 add：任何一个 404 都不该让整次安装失败 */
      .then(cache => Promise.all(CORE.map(p => cache.add(abs(p)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;   // 第三方：不介入
  if (url.pathname.indexOf('/api/') > -1) return;    // 接口：不缓存

  if (req.mode === 'navigate') {
    event.respondWith(navFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function navFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    /* 只缓存正常 HTML；404/500 这类不落盘，免得把错误页固化下来。
       缓存键去掉查询串：同一篇文章不管带什么参数（如搜索高亮 ?hit=）都只存一份 */
    if (res && res.ok && (res.headers.get('content-type') || '').indexOf('text/html') > -1) {
      const path = new URL(req.url).pathname;
      cache.put(new URL(path, ROOT).href, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    /* 离线页按两条路径找：Pages 上是 /offline，静态托管/本地是 /offline.html */
    const off = await cache.match(abs('offline')) || await cache.match(abs('offline.html'));
    if (off) return off;
    return new Response('离线，且这篇还没缓存过', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const network = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  return new Response('', { status: 504, statusText: 'offline' });
}
