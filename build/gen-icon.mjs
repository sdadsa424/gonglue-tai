/* 站点图标生成器：从同一份 SVG 直出各尺寸 PNG（Edge headless 精确渲染，非位图缩放）
   用法：node build/gen-icon.mjs
   产物：assets/favicon.svg、favicon-16/32.png、apple-touch-icon.png、
        icon-192/512.png、icon-maskable-512.png（favicon.ico 由 build/gen-ico.py 合成）*/
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const GOLD = `<linearGradient id="gold" x1="0" y1="0" x2="0.25" y2="1">
<stop offset="0" stop-color="#FFF6D6"/><stop offset="0.42" stop-color="#FFD45E"/><stop offset="1" stop-color="#CE8802"/></linearGradient>`;
const BG = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#1C1338"/><stop offset="1" stop-color="#090A12"/></linearGradient>`;

function art({ rx = 0, scale = 1, w = 512 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${w}" height="${w}">
<defs>${BG}${GOLD}</defs>
<rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
  <path d="M104 366 L104 176 L176 238 L256 122 L336 238 L408 176 L408 366 Z" fill="url(#gold)"/>
  <circle cx="104" cy="160" r="19" fill="#FFF6D6"/>
  <circle cx="256" cy="106" r="23" fill="#FFF6D6"/>
  <circle cx="408" cy="160" r="19" fill="#FFF6D6"/>
  <rect x="96" y="354" width="320" height="82" rx="26" fill="url(#gold)"/>
  <rect x="96" y="354" width="320" height="82" rx="26" fill="none" stroke="#A86E00" stroke-opacity="0.32" stroke-width="3"/>
  <circle cx="256" cy="395" r="20" fill="#FF3D9A"/>
  <circle cx="249" cy="388" r="6" fill="#FFFFFF" fill-opacity="0.5"/>
</g>
</svg>`;
}

const ROUND = art({ rx: 112 });
const SQUARE = art({ rx: 0 });
const MASKABLE = art({ rx: 0, scale: 0.78 });

// 1) 矢量 favicon（浏览器优先用它，任何分辨率都清晰）
fs.writeFileSync('assets/favicon.svg', ROUND + '\n');
console.log('assets/favicon.svg');

// 2) 起 Edge headless
const port = 9600 + (process.pid % 300);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(os.tmpdir(), 'cdp-icon-' + port),
  '--window-size=512,512', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 40 && !list; i++) {
  await sleep(250);
  try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { }
}
if (!list) { console.error('CDP 启动失败'); process.exit(1); }

const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) pend[m.id](m); };
const send = (method, params = {}) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

const tmp = path.join(os.tmpdir(), 'icon-' + port);
fs.mkdirSync(tmp, { recursive: true });

async function shoot(svg, size, out) {
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:100vw;height:100vh}</style>${svg}`;
  const f = path.join(tmp, `t${size}.html`);
  fs.writeFileSync(f, html);
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file:///' + f.replace(/\\/g, '/') });
  await sleep(260);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(out, size + 'x' + size);
}

await shoot(ROUND, 16, 'assets/favicon-16.png');
await shoot(ROUND, 32, 'assets/favicon-32.png');
await shoot(ROUND, 192, 'assets/icon-192.png');
await shoot(ROUND, 512, 'assets/icon-512.png');
await shoot(SQUARE, 180, 'assets/apple-touch-icon.png');
await shoot(ROUND, 48, 'assets/favicon-48.png');
await shoot(MASKABLE, 512, 'assets/icon-maskable-512.png');

proc.kill();
console.log('done');
process.exit(0);
