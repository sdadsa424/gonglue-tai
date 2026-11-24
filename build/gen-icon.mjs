/* 站点图标生成器：从同一份 SVG 直出各尺寸 PNG（Edge headless 精确渲染，非位图缩放）
   当前设计：向日葵小窝 —— 暖色渐变底 + 笑脸向日葵 + 叶子 + 奶油小窝
   用法：node build/gen-icon.mjs
   产物：assets/favicon.svg、favicon-16/32.png、apple-touch-icon.png、
        icon-192/512.png、icon-maskable-512.png（favicon.ico 由 PIL 从 PNG 合成）*/
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const BGW = `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#FFE9A8"/><stop offset="0.55" stop-color="#FFC978"/><stop offset="1" stop-color="#FF9E7A"/></linearGradient>`;
const CORE = `<radialGradient id="core" cx="0.5" cy="0.42" r="0.65">
<stop offset="0" stop-color="#FFE29A"/><stop offset="0.55" stop-color="#F5B942"/><stop offset="1" stop-color="#D98A2B"/></radialGradient>`;
const LEAF = `<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#7ED26B"/><stop offset="1" stop-color="#4CA84A"/></linearGradient>`;

const SCENE = `
  <path d="M200 210 C 195 234, 205 250, 200 274" fill="none" stroke="#4CA84A" stroke-width="15" stroke-linecap="round"/>
  <path d="M198 244 C 168 242, 144 228, 132 206 C 160 202, 186 216, 198 238 Z" fill="url(#leaf)" stroke="#3B8A3C" stroke-width="5" stroke-linejoin="round"/>
  <path d="M202 256 C 232 254, 258 240, 270 218 C 242 214, 216 228, 202 250 Z" fill="url(#leaf)" stroke="#3B8A3C" stroke-width="5" stroke-linejoin="round"/>
  <path d="M116 340 A 88 74 0 0 1 284 340 Z" fill="#FFF4DC" stroke="#E8A24C" stroke-width="7" stroke-linejoin="round"/>
  <path d="M178 340 A 22 26 0 0 1 222 340 Z" fill="#B97B3E" stroke="#8A5626" stroke-width="5"/>
  <circle cx="213" cy="324" r="4" fill="#FFD766"/>
  <g fill="#FFC53D" stroke="#E8952E" stroke-width="5" stroke-linejoin="round">
    <ellipse cx="200" cy="96"  rx="26" ry="40"/>
    <ellipse cx="200" cy="176" rx="26" ry="40"/>
    <ellipse cx="120" cy="136" rx="40" ry="26"/>
    <ellipse cx="280" cy="136" rx="40" ry="26"/>
    <g transform="rotate(45 200 136)">
      <ellipse cx="200" cy="98"  rx="24" ry="38"/>
      <ellipse cx="200" cy="174" rx="24" ry="38"/>
      <ellipse cx="122" cy="136" rx="38" ry="24"/>
      <ellipse cx="278" cy="136" rx="38" ry="24"/>
    </g>
  </g>
  <circle cx="200" cy="136" r="58" fill="url(#core)" stroke="#B26E1F" stroke-width="6"/>
  <g fill="#B26E1F" opacity="0.35">
    <circle cx="178" cy="116" r="4"/><circle cx="222" cy="116" r="4"/>
    <circle cx="166" cy="146" r="4"/><circle cx="200" cy="156" r="4"/><circle cx="234" cy="146" r="4"/>
    <circle cx="184" cy="132" r="4"/><circle cx="216" cy="132" r="4"/>
  </g>
  <g stroke="#5A3A10" stroke-width="7" stroke-linecap="round" fill="none">
    <path d="M172 128 Q 182 116 192 128"/>
    <path d="M208 128 Q 218 116 228 128"/>
  </g>
  <ellipse cx="166" cy="146" rx="12" ry="8" fill="#FF8A65" opacity="0.75"/>
  <ellipse cx="234" cy="146" rx="12" ry="8" fill="#FF8A65" opacity="0.75"/>
  <path d="M186 152 Q 200 166 214 152" fill="none" stroke="#5A3A10" stroke-width="7" stroke-linecap="round"/>
  <g fill="#FFFFFF" opacity="0.85">
    <circle cx="88" cy="90" r="8"/><circle cx="322" cy="84" r="6"/>
    <circle cx="314" cy="196" r="7"/><circle cx="76" cy="200" r="5"/>
  </g>
  <g fill="#FFF3B0" stroke="#F0B429" stroke-width="3" stroke-linejoin="round">
    <path d="M318 120 l5 10 11 2 -8 8 2 11 -10 -5 -10 5 2 -11 -8 -8 11 -2 Z"/>
    <path d="M84 148 l4 8 9 2 -6 7 1 9 -8 -4 -8 4 1 -9 -6 -7 9 -2 Z"/>
  </g>`;

function art({ rx = 0, scale = 1, w = 512 }) {
  const inner = rx
    ? `<rect x="10" y="10" width="380" height="380" rx="${rx - 14}" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="5"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="${w}" height="${w}">
<defs>${BGW}${CORE}${LEAF}</defs>
<rect width="400" height="400" rx="${rx}" fill="url(#bg)"/>
${inner}
<g transform="translate(200 200) scale(${scale}) translate(-200 -200)">${SCENE}
</g>
</svg>`;
}

const ROUND = art({ rx: 96 });
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
