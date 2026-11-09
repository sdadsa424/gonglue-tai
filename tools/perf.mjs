/* 性能与控制台体检：node tools/perf.mjs <url> [width]
   输出：传输体积、请求数、FCP/LCP/CLS、慢资源 Top5、控制台错误 */
const [, , url = 'http://127.0.0.1:8766/', W = '1280'] = process.argv;
const port = 9500 + (process.pid % 400);
const { spawn } = await import('node:child_process');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/perf-' + port, '--window-size=' + W + ',900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 40 && !list; i++) {
  await sleep(250);
  try { list = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); } catch (e) { }
}
if (!list) { console.error('CDP 启动失败'); process.exit(1); }
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = {};
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend[m.id]) pend[m.id](m);
  if (m.method === 'Runtime.exceptionThrown') errors.push('异常: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 160));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 160));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: 900, deviceScaleFactor: 1, mobile: +W < 600 });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__cls = 0;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { const e = l.getEntries(); window.__lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
` });
await send('Page.navigate', { url });
await sleep(3500);

const expr = `(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const res = performance.getEntriesByType('resource').map(r => ({ u: r.name.replace(location.origin, ''), t: r.transferSize || 0, d: Math.round(r.duration) }));
  const total = res.reduce((a, b) => a + b.t, 0);
  const big = res.filter(r => r.t > 0).sort((a, b) => b.t - a.t).slice(0, 5).map(r => Math.round(r.t / 1024) + 'KB ' + r.u);
  const slow = res.slice().sort((a, b) => b.d - a.d).slice(0, 5).map(r => r.d + 'ms ' + r.u);
  const paint = performance.getEntriesByType('paint').map(p => p.name + '=' + Math.round(p.startTime));
  const lcp = window.__lcp || 0;
  return JSON.stringify({
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    load: Math.round(nav.loadEventEnd || 0),
    transferKB: Math.round(total / 1024),
    requests: res.length,
    paint, lcp: Math.round(lcp),
    htmlKB: Math.round((nav.transferSize || 0) / 1024),
    cls: +(window.__cls || 0).toFixed(3),
    big, slow,
    imgs: document.images.length,
    eagerImgs: [...document.images].filter(i => i.loading !== 'lazy' && i.getBoundingClientRect().width > 0).length
  }, null, 1);
})()`;
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(res.result.result.value);
if (errors.length) { console.log('\n控制台问题：'); errors.slice(0, 6).forEach((e) => console.log('  · ' + e)); }
else console.log('\n控制台：无错误');
proc.kill();
process.exit(0);
