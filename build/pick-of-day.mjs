/* ===== 精品推荐每日轮换 =====
 * 用法：GHPAT=xxx node build/pick-of-day.mjs [--dry-run]
 * 逻辑：按当天日期做种子，从 10 款游戏里轮换选出 4 款、每款再轮换 1 篇攻略，
 *       重写 index.html 首页「精选攻略轮播」4 张 slide，再经 push-via-api.py 推送。
 *       同一天重复运行结果一致（幂等），内容无变化则跳过推送。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const { GAMES, GUIDES } = require('../assets/data.js');
const ORDER = ['ejl', 'xxtl', 'ty', 'luna2', 'cq3d', 'wlwz', 'xxjz', 'lzgsy', 'gc', 'dbwl'];
const DRY = process.argv.includes('--dry-run');

/* 各游戏兜底 hero 图（assets/ 下已确认存在的 jpg 基图） */
const HERO = {
  ejl:   { v: 'ejl-hero',       w: 1264, h: 628 },
  xxtl:  { v: 'xxtl-siege',     w: 1080, h: 608 },
  ty:    { v: 'ty-key',         w: 1600, h: 900 },
  luna2: { v: 'luna2-hero',     w: 1264, h: 711 },
  cq3d:  { v: 'cq3d-class',     w: 1264, h: 710 },
  wlwz:  { v: 'wlwz-feat-inn',  w: 750,  h: 422 },
  xxjz:  { v: 'xxjz-feat-sect', w: 750,  h: 422 },
  lzgsy: { v: 'lzgsy-hero',     w: 1264, h: 628 },
  gc:    { v: 'gc-hero',        w: 1264, h: 628 },
  dbwl:  { v: 'dbwl-hero',      w: 1264, h: 628 }
};

/* ---- 确定性伪随机：同一天结果固定，不同天不同 ---- */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seedStr) {
  let a = hash(seedStr);
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- 选篇：4 款游戏各出 1 篇，日日不同 ---- */
function pickOfTheDay(dateStr) {
  const gRng = rng('games:' + dateStr);
  const games = ORDER.filter(gk => GUIDES.some(g => g.game === gk)).sort(() => gRng() - 0.5).slice(0, 4);
  return games.map(gk => {
    const pool = GUIDES.filter(g => g.game === gk);
    const r = rng('guide:' + dateStr + ':' + gk)();
    return pool[Math.floor(r * pool.length) % pool.length];
  });
}

/* ---- 配图解析：优先攻略自带图，文件缺失则回退游戏 hero ---- */
function imageFor(guide) {
  const imgs = (guide.blocks || []).filter(b => b.t === 'img');
  for (const b of imgs) {
    if (fs.existsSync(path.join(root, 'assets', b.v + '.jpg'))) {
      return { v: b.v, w: b.w || 1264, h: b.h || 628, alt: b.alt || GAMES[guide.game].name + ' 攻略配图' };
    }
  }
  const hero = HERO[guide.game];
  return { v: hero.v, w: hero.w, h: hero.h, alt: GAMES[guide.game].name + ' 主视觉' };
}

/* ---- 生成 picture：探测 avif/webp 变体构建 srcset，全缺则裸 img ---- */
const SIZES = '(max-width:760px) 92vw, 1180px';
function pictureHTML(img, eager) {
  const imgAttrs = eager
    ? `src="assets/${img.v}.jpg" alt="${esc(img.alt)}" width="${img.w}" height="${img.h}" fetchpriority="high" decoding="async"`
    : `src="assets/${img.v}.jpg" alt="${esc(img.alt)}" width="${img.w}" height="${img.h}" loading="lazy" decoding="async"`;
  const fmts = [];
  for (const f of ['avif', 'webp']) {
    const entries = [];
    for (const s of [720, 960, 1264]) {
      if (s !== img.w && fs.existsSync(path.join(root, 'assets', `${img.v}_${s}w.${f}`))) entries.push(`assets/${img.v}_${s}w.${f} ${s}w`);
    }
    if (fs.existsSync(path.join(root, 'assets', `${img.v}.${f}`))) entries.push(`assets/${img.v}.${f} ${img.w}w`);
    if (entries.length) fmts.push(`<source srcset="${entries.join(', ')}" sizes="${SIZES}" type="image/${f}">`);
  }
  if (!fmts.length) return `<img ${imgAttrs}>`;
  return `<picture>${fmts.join('')}<img ${imgAttrs}></picture>`;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ---- 摘要：dek 过长则截断 ---- */
function dekOf(guide) {
  const d = (guide.dek || '').trim();
  if (d.length <= 48) return d;
  const cut = d.slice(0, 44);
  const stop = cut.lastIndexOf('。');
  return (stop > 16 ? cut.slice(0, stop + 1) : cut) + '…';
}

function slideHTML(guide, idx) {
  const game = GAMES[guide.game];
  const img = imageFor(guide);
  const cls = idx === 0 ? 'fc-slide is-on' : 'fc-slide';
  const aria = idx === 0 ? '' : ' aria-hidden="true"';
  return [
    `      <a class="${cls}" href="a/${guide.id}/" style="--ac:${game.accent}"${aria}>`,
    `        ${pictureHTML(img, idx === 0)}`,
    `        <span class="fc-shade" aria-hidden="true"></span>`,
    `        <span class="fc-cap"><span class="fc-k">精选推荐</span><h3>${esc(guide.title)}</h3><p>${esc(dekOf(guide))}</p><span class="fc-go">去读攻略 →</span></span>`,
    `      </a>`
  ].join('\n');
}

/* ---- 主流程 ---- */
const today = new Date();
const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const picks = pickOfTheDay(dateStr);
console.log(`[${dateStr}] 今日精选：` + picks.map(g => `${GAMES[g.game].name}《${g.title}》`).join(' / '));

const indexPath = path.join(root, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const startTag = '<a class="fc-slide is-on"';
const endTag = '      <div class="fc-dots"';
const s = html.indexOf(startTag);
const e = html.indexOf(endTag);
if (s < 0 || e < 0 || e < s) { console.error('未找到轮播区块标记'); process.exit(1); }
const next = html.slice(0, s) + picks.map((g, i) => slideHTML(g, i)).join('\n') + '\n' + html.slice(e);

if (next === html) {
  console.log('轮播内容无变化，跳过写入与推送');
  process.exit(0);
}
if (DRY) { console.log('--dry-run：已生成预览，未写入'); process.exit(0); }

/* 基本校验：4 张 slide、首图 eager、链接真实 */
const m = next.slice(s, next.indexOf(endTag));
if ((m.match(/class="fc-slide/g) || []).length !== 4) { console.error('slide 数量异常'); process.exit(1); }
for (const g of picks) {
  if (!fs.existsSync(path.join(root, 'a', g.id, 'index.html'))) { console.error('攻略页不存在：a/' + g.id); process.exit(1); }
  if (!fs.existsSync(path.join(root, 'assets', imageFor(g).v + '.jpg'))) { console.error('配图缺失：' + imageFor(g).v); process.exit(1); }
}
fs.writeFileSync(indexPath, next, 'utf8');
console.log('index.html 轮播已更新');

/* ---- 推送 ---- */
const GHPAT = process.env.GHPAT;
if (!GHPAT) { console.error('缺少 GHPAT 环境变量，已写入本地但未推送'); process.exit(1); }
const r = spawnSync('python', ['build/push-via-api.py', 'index.html'], {
  stdio: 'inherit',
  env: { ...process.env, COMMIT_MSG: `精选推荐每日轮换 ${dateStr}：` + picks.map(g => g.title).join('、') }
});
process.exit(r.status || 0);
