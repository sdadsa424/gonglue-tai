/* 轻量 CDP 检查：node tools/cdp-check.mjs <url> [width] [height]
   输出：文档滚动宽度 vs 视口宽度，并列出超出视口的元素（前 12 个） */
const [, , url = 'http://127.0.0.1:8766/g/luna2/', W = '390', H = '844'] = process.argv;
const port = 9333 + (process.pid % 500);
const { spawn } = await import('node:child_process');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/cdp-' + port, '--window-size=' + W + ',' + H, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 40 && !list; i++) {
  await sleep(250);
  try { list = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); } catch (e) { }
}
if (!list) { console.error('CDP 启动失败'); process.exit(1); }
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) pend[m.id](m); };
const send = (method, params = {}) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 600 });
await send('Page.navigate', { url });
await sleep(2600);
const expr = `(() => {
  const vw = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
  const bad = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return;
      bad.push(el.tagName + '.' + String(el.className).split(' ').slice(0,2).join('.') + ' left=' + Math.round(r.left) + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width));
    }
  });
  return JSON.stringify({ vw, sw, body: document.body.scrollWidth, bad: bad.slice(0, 12), total: bad.length }, null, 1);
})()`;
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(res.result.result.value);
proc.kill();
process.exit(0);
