/* 轻量 CDP 截图：node tools/cdp-shot.mjs <url> <out.png> [width] [height] [selector] */
const [, , url = 'http://127.0.0.1:8766/', out = 'shot.png', W = '1280', H = '900', selector = ''] = process.argv;
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
if (selector) {
  await send('Runtime.evaluate', { expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top: y, behavior: 'instant' }); } })()`, returnByValue: true });
  await sleep(1800);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
const { writeFileSync } = await import('node:fs');
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
proc.kill();
process.exit(0);
