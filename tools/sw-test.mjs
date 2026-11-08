/* 离线缓存真机验证：起本地服务 + 无头 Edge（CDP 驱动）
 * 1) 首次访问 → 等 service worker 接管
 * 2) 再访一篇文章（进缓存）
 * 3) 断网 → 刷新首页 & 已读文章，应正常显示；未读文章应落到离线页
 * 用法：node tools/sw-test.mjs
 */
import { spawn } from 'node:child_process';
import { rm, readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const PORT = 8792;
const CDP = 9333;
const ROOT = process.cwd();
const PROFILE = path.join(process.env.TEMP || '/tmp', 'edge-sw-test-' + Date.now());
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

/* 极简静态服务：不依赖 npx，端口起来就绪，避免测试被外部命令拖住 */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.avif': 'image/avif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    try {
      const nf = await readFile(path.join(ROOT, '404.html'));
      res.writeHead(404, { 'Content-Type': MIME['.html'] }).end(nf);
    } catch (e2) { res.writeHead(404).end('404'); }
  }
});
const startServer = () => new Promise(r => server.listen(PORT, '127.0.0.1', r));
const stopServer = () => new Promise(r => { try { server.closeAllConnections?.(); } catch (e) {} server.close(() => r()); });
await startServer();

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? '  → ' + extra : '')));
};

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + CDP, '--user-data-dir=' + PROFILE, 'about:blank'
], { stdio: 'ignore' });

async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(250);
  }
  throw new Error('CDP 未就绪：' + url);
}

let ws, seq = 0;
const pending = new Map();
const events = [];
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evalJs(expression, awaitPromise = true) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.text };
  return r.result.value;
}
async function nav(url) {
  events.length = 0;
  await send('Page.navigate', { url });
  for (let i = 0; i < 80; i++) {
    if (events.includes('load')) break;
    await sleep(120);
  }
  await sleep(500);
}

try {
  const ver = await waitJson(`http://127.0.0.1:${CDP}/json/version`);
  const tgt = await (await fetch(`http://127.0.0.1:${CDP}/json/new?http://127.0.0.1:${PORT}/`, { method: 'PUT' })).json();
  ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    } else if (m.method === 'Page.loadEventFired') events.push('load');
  };
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('[1] 首次访问 + SW 注册');
  await nav(`http://127.0.0.1:${PORT}/`);
  const swState = await evalJs(`navigator.serviceWorker.ready.then(r => r.active ? r.active.state : 'none')`);
  ok('service worker 安装并激活', swState === 'activated', String(swState));
  const cacheInfo = await evalJs(`caches.keys().then(ks => ks.join(','))`);
  ok('缓存已建立且带版本号', /^gl-[0-9a-f]{10}$/.test(String(cacheInfo)), String(cacheInfo));
  const cachedCount = await evalJs(`caches.keys().then(ks => caches.open(ks[0])).then(c => c.keys()).then(k => k.length)`);
  ok('预缓存资源已落盘（≥10 项）', Number(cachedCount) >= 10, String(cachedCount));

  console.log('[2] 访问一篇攻略（进运行时缓存）');
  await nav(`http://127.0.0.1:${PORT}/a/ejl-start/`);
  const title = await evalJs(`document.querySelector('.a-title') && document.querySelector('.a-title').textContent`);
  ok('文章页正常渲染', /新手村/.test(String(title)), String(title));

  console.log('[3] 真断网（停掉本地服务）');
  await stopServer();

  await nav(`http://127.0.0.1:${PORT}/`);
  const homeName = await evalJs(`(document.querySelector('.brand-name') || {}).textContent || ''`);
  ok('断网刷新首页仍可打开（走缓存）', /攻略/.test(String(homeName)), String(homeName));
  const cards = await evalJs(`document.querySelectorAll('.entry').length`);
  ok('断网首页攻略卡片仍在', Number(cards) > 0, String(cards));

  await nav(`http://127.0.0.1:${PORT}/a/ejl-start/`);
  const title2 = await evalJs(`(document.querySelector('.a-title') || {}).textContent || ''`);
  ok('断网打开读过的文章正常', /新手村/.test(String(title2)), String(title2));

  await nav(`http://127.0.0.1:${PORT}/a/ty-account/`);
  const body = await evalJs(`document.body.innerText.replace(/\\s+/g, ' ').slice(0, 60)`);
  ok('断网打开没读过的文章 → 离线页', /没有网络/.test(String(body)), String(body));

  console.log('[4] 恢复网络（重启服务）');
  await startServer();
  await nav(`http://127.0.0.1:${PORT}/a/ty-account/`);
  const title3 = await evalJs(`(document.querySelector('.a-title') || {}).textContent || ''`);
  ok('恢复网络后未读文章可正常加载', String(title3).length > 0, String(title3));
} catch (e) {
  fail++;
  console.log('  ✗ 测试异常：' + e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  edge.kill();
  try { server.close(); } catch (e) {}
  await sleep(600);
  await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}
