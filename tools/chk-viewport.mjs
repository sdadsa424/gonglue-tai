/* 复现截图场景：不带 mobile 仿真，390 宽下查溢出并截图 */
const url = process.argv[2] || 'http://127.0.0.1:8766/';
const port = 9900 + (process.pid % 200);
const { spawn } = await import('node:child_process');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/chk-' + port, '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 40 && !list; i++) { await sleep(250); try { list = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); } catch (e) { } }
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = {};
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) pend[m.id](m); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(3000);
const expr = `(() => {
  const vw = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('.fx-layer,.meteors')) return;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1) bad.push(el.tagName + '.' + String(el.className).split(' ').slice(0,2).join('.') + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width));
  });
  return JSON.stringify({ vw, sw, bad: bad.slice(0, 10), total: bad.length });
})()`;
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(res.result.result.value);
const shot = await send('Page.captureScreenshot', { format: 'png' });
(await import('node:fs')).writeFileSync(process.env.TEMP + '/chk-nomobile.png', Buffer.from(shot.result.data, 'base64'));
console.log('截图: %TEMP%/chk-nomobile.png');
proc.kill();
process.exit(0);
