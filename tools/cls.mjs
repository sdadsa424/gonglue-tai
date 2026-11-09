/* 定位 CLS 来源：node tools/cls.mjs <url> [width] */
const [, , url = 'https://wgame-bc7.pages.dev/', W = '1280'] = process.argv;
const port = 9700 + (process.pid % 200);
const { spawn } = await import('node:child_process');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/cls-' + port, '--window-size=' + W + ',900', 'about:blank'], { stdio: 'ignore' });
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
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
  window.__shifts = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__shifts.push({
        v: +e.value.toFixed(4), t: Math.round(e.startTime),
        nodes: (e.sources || []).map(s => (s.node && (s.node.tagName || '') + '.' + String(s.node.className || '').split(' ')[0]) || '?'),
        prev: (e.sources || []).map(s => s.previousRect ? Math.round(s.previousRect.y) + '@' + Math.round(s.previousRect.height) : ''),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  `
});
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: 900, deviceScaleFactor: 1, mobile: +W < 600 });
await send('Page.navigate', { url });
await sleep(5000);
const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__shifts.slice(0,8))', returnByValue: true });
const shifts = JSON.parse(r.result.result.value || '[]');
console.log('CLS 事件数', shifts.length, '合计', shifts.reduce((a, b) => a + b.v, 0).toFixed(3));
shifts.forEach((s) => console.log(`  ${s.v} @${s.t}ms  ${s.nodes.join(',')} prev=${s.prev.join(',')}`));
proc.kill();
process.exit(0);
