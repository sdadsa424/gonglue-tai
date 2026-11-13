/**
 * 静态攻略页构建：把 assets/data.js 里的攻略预渲染成真实 URL 的 HTML
 * 产出：a/<id>/index.html × N、sitemap.xml、robots.txt
 * 用法：node build/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GAMES, CATS, GUIDES } = require('../assets/data.js');

/* 站点根地址：默认新域名，可用 SITE_URL 覆盖，换域名时只改这一处 */
const SITE = (process.env.SITE_URL || 'https://wgame-bc7.pages.dev/').replace(/\/+$/, '') + '/';
const SITE_ORIGIN = SITE.replace(/\/$/, '');
const SITE_NAME = '游戏攻略大全';
/* ---------- 文章日期自动管理 ----------
 * build/dates.json 记录每篇的内容指纹 + 日期：
 *   新文章或内容变化 → 自动标构建当天；内容没变 → 保持原日期
 * data.js 里显式写 d 字段可手动指定（优先级最高）
 */
const DATES_FILE = path.join(import.meta.dirname, 'dates.json');
const TODAY = new Date().toLocaleDateString('sv-SE'); // 本地时区 YYYY-MM-DD
const SEED_DATE = '2026-11-05'; // 档案首次建立前就已存在的老文章，日期回落到此

function buildDates() {
  const prev = fs.existsSync(DATES_FILE) ? JSON.parse(fs.readFileSync(DATES_FILE, 'utf8')) : {};
  const next = {};
  for (const gi of GUIDES) {
    const h = crypto.createHash('sha1').update(JSON.stringify({ ...gi, d: undefined })).digest('hex').slice(0, 12);
    const p = prev[gi.id];
    if (gi.d) next[gi.id] = { h, d: gi.d };                    // 手动指定优先
    else if (!p) next[gi.id] = { h, d: p ? p.d : (prev.__seeded ? TODAY : SEED_DATE) };
    else if (p.h !== h) next[gi.id] = { h, d: TODAY };         // 内容变了 → 今天
    else next[gi.id] = p;                                      // 没变 → 保持
  }
  next.__seeded = true;
  fs.writeFileSync(DATES_FILE, JSON.stringify(next, null, 2) + '\n');
  const { __seeded: _, ...dates } = next;
  return dates;
}
const DATES = buildDates();
const gdate = gi => (DATES[gi.id] || {}).d || SEED_DATE;
const GDATE = guideId => (DATES[guideId] || {}).d || SEED_DATE;
/* 全站级 lastmod：取所有文章日期的最大值 */
const SITE_LASTMOD = GUIDES.map(gdate).sort().pop();
const ORDER = ['ejl', 'xxtl', 'ty', 'luna2', 'yxlc'];
const CS = 'ggboy6123';


/* 搜索结果标题里用的游戏短名：只用于 title，页面显示仍用完整游戏名 */
const SEO_NAME = { ejl: '贰点零江湖', xxtl: '小小屠龙', ty: '桃园将帅录', luna2: '露娜2', yxlc: '英雄连城' };

/* 标题最多约 30 个汉字才会完整显示，超了就把游戏名换成短名、再去掉「攻略」两个字 */
function seoTitle(head, gameKey) {
  const short = SEO_NAME[gameKey] || head;
  const full = head + ' · ' + short + '攻略';
  if (full.length <= 30) return full;
  const lite = head + ' · ' + short;
  return lite.length <= 30 ? lite : full;
}

/* 描述目标是 60~110 字：以导语打底，逐条追加核心要点，到长度就停，保证句子完整 */
function seoDesc(gi) {
  let d = gi.dek;
  for (const t of gi.take || []) {
    const next = d + (/[。！？]$/.test(d) ? '' : '；') + t + '。';
    if (next.length > 110) break;
    d = next;
  }
  return d;
}

const HERO = { ejl: 'assets/hero-ejl.jpg', xxtl: 'assets/hero-xxtl.jpg', ty: 'assets/hero-ty.jpg', luna2: 'assets/luna2-hero.jpg', yxlc: 'assets/yxlc-hero.jpg' };
/* favicon 由 build/gen-icon.mjs 生成的 assets/favicon.svg / PNG 提供 */

/* ---------- 工具 ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escJson = s => JSON.stringify(s).replace(/</g, '\\u003c');

/* 描述长度裁剪：搜索结果里超过 100 字会被截断成省略号，且截断点多在半句，
 * 这里主动在 100 字内最后一个句读处断开，保证 SERP 里读起来是完整的一口气 */
const clipDesc = (s, max = 100) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const cut = Math.max(head.lastIndexOf('。'), head.lastIndexOf('；'), head.lastIndexOf('，'), head.lastIndexOf('、'));
  return (cut >= 60 ? head.slice(0, cut) : head.replace(/[，、；]$/, '')) + '…';
};

const IDX = {};
ORDER.forEach(k => {
  let n = 0;
  GUIDES.filter(x => x.game === k).forEach(x => { n += 1; IDX[x.id] = String(n).padStart(2, '0'); });
});

function guideText(gi) {
  let s = gi.title + gi.dek + gi.take.join('');
  gi.blocks.forEach(b => {
    if (b.t === 'img') return;
    if (b.t === 'table') s += b.head.join('') + b.rows.map(r => r.join('')).join('');
    else if (Array.isArray(b.v)) s += b.v.join('');
    else s += b.v;
  });
  return s;
}
const readMin = gi => Math.max(2, Math.round(guideText(gi).length / 300));
const sectionsOf = gi => gi.blocks.filter(b => b.t === 'h').length;

function blockHTML(b, up) {
  up = up || '';
  if (b.t === 'h') return '<h2>' + esc(b.v) + '</h2>';
  if (b.t === 'p') return '<p>' + esc(b.v) + '</p>';
  if (b.t === 'note') return '<p class="note">' + esc(b.v) + '</p>';
  if (b.t === 'ul') return '<ul>' + b.v.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
  if (b.t === 'img') {
    const base = up + 'assets/' + b.v;
    const w = b.w || 1080, h = b.h || 608;
    return '<figure class="fig"><picture>'
      + '<source srcset="' + base + '.avif" type="image/avif">'
      + '<source srcset="' + base + '.webp" type="image/webp">'
      + '<img src="' + base + '.jpg" alt="' + esc(b.alt || '') + '" width="' + w + '" height="' + h + '" loading="lazy" decoding="async">'
      + '</picture>'
      + (b.cap ? '<figcaption>' + esc(b.cap) + '</figcaption>' : '')
      + '</figure>';
  }
  if (b.t === 'table') {
    const cols = b.w.map(w => '<col style="width:' + w + '%">').join('');
    return '<div class="tbl-wrap"><table class="tbl"><colgroup>' + cols + '</colgroup><thead><tr>'
      + b.head.map(h => '<th>' + esc(h) + '</th>').join('')
      + '</tr></thead><tbody>'
      + b.rows.map(r => '<tr>' + r.map((c, i) => '<td data-label="' + esc(b.head[i]) + '">' + esc(c) + '</td>').join('') + '</tr>').join('')
      + '</tbody></table></div>';
  }
  return '';
}

/* 攻略页里的相对层级固定为 a/<id>/ → 回到站点根用 ../../；
   生成根目录页面（404）时临时改成 '/'，生成完再改回来 */
let UP = '../../';

/* 顶栏天气会连两个外部接口、页脚有第三方统计：提前建连，省掉两轮 TLS 握手 */
const PRECONNECT = `<link rel="preconnect" href="https://ipwho.is" crossorigin>
<link rel="preconnect" href="https://ipapi.co" crossorigin>
<link rel="preconnect" href="https://api.open-meteo.com" crossorigin>
<link rel="dns-prefetch" href="https://busuanzi.ibruce.info">`;

function topbar(activeGame) {
  return `<header class="topbar">
  <div class="wrap topbar-in">
    <a class="brand" href="${UP}" aria-label="${SITE_NAME}首页">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-name">${SITE_NAME}</span>
      <span class="brand-sub">游戏 · 一处查完</span>
    </a>
    <nav class="nav" aria-label="主导航">
      <a href="${UP}#library">攻略库</a>
      <a href="${UP}#route">开荒路线</a>
      <a href="${UP}#games">游戏</a>
    </nav>
    <div class="tb-right">
    <button class="luck-btn achv-btn" id="achvBtn" type="button" title="成就墙" aria-label="查看成就墙"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/></svg></button>
    <div class="wt" id="wt" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-label="当地时间与天气，点击设置定位">
      <span class="wt-clock"><b data-wt-h>--</b><i aria-hidden="true">:</i><b data-wt-m>--</b></span>
      <span class="wt-wx" data-wt-wx hidden>
        <span class="wt-ico" data-wt-ico aria-hidden="true"></span>
        <b class="wt-temp" data-wt-temp>--°</b>
        <i class="wt-city" data-wt-city hidden></i>
      </span>
    </div>
    <div class="wt-pop" id="wt-pop" role="dialog" aria-label="定位设置" hidden>
      <div class="wt-pop-top">
        <span class="wt-pop-cur"><b data-wt-cur>定位中</b><i data-wt-src>按 IP 估算</i></span>
        <button class="wt-x" type="button" data-wt-close aria-label="关闭定位设置"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="wt-pop-btns">
        <button class="wt-b" type="button" data-wt-gps><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>使用我的位置</button>
        <button class="wt-b" type="button" data-wt-auto>按 IP 自动</button>
      </div>
      <div class="wt-pop-q"><input type="search" data-wt-q placeholder="输入城市名，或拼音" autocomplete="off" spellcheck="false" aria-label="搜索城市"></div>
      <div class="wt-chips" data-wt-chips>
        <button type="button" data-lat="39.9042" data-lon="116.4074" data-n="北京">北京</button>
        <button type="button" data-lat="31.2304" data-lon="121.4737" data-n="上海">上海</button>
        <button type="button" data-lat="23.1291" data-lon="113.2644" data-n="广州">广州</button>
        <button type="button" data-lat="22.5431" data-lon="114.0579" data-n="深圳">深圳</button>
        <button type="button" data-lat="30.2741" data-lon="120.1551" data-n="杭州">杭州</button>
        <button type="button" data-lat="30.5728" data-lon="104.0668" data-n="成都">成都</button>
        <button type="button" data-lat="30.5928" data-lon="114.3055" data-n="武汉">武汉</button>
        <button type="button" data-lat="29.563" data-lon="106.5516" data-n="重庆">重庆</button>
        <button type="button" data-lat="34.3416" data-lon="108.9398" data-n="西安">西安</button>
        <button type="button" data-lat="32.0603" data-lon="118.7969" data-n="南京">南京</button>      </div>
      <ul class="wt-res" data-wt-res hidden></ul>
      <p class="wt-pop-tip" data-wt-tip aria-live="polite" hidden></p>
      <p class="wt-pop-note">定位只用来显示天气，不记录、不上传</p>
    </div>
      <button class="tb-search" type="button" data-palette aria-label="全站搜索（快捷键 Ctrl 或 Command 加 K）">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>
        <span>搜索</span>
        <span class="tb-kbd">⌘K</span>
      </button>
    </div>
  </div>
</header>`;
}

function footer(activeGame) {
  return `<footer class="foot">
  <div class="wrap">
    <div class="foot-in">
      <div>
        <p class="foot-name">${SITE_NAME}</p>
        <p>一个玩家整理的攻略站，把五款游戏里真正会用到的判断写成条目：什么时候走、什么时候留、什么该卖、什么该留。站内文章按游戏与阶段索引，持续补充。</p>
        <p class="foot-cs">获取游戏与开服信息：<button class="cs-pill dark" type="button" data-copy="${CS}"><b>游戏客服 ${CS}</b><span class="cs-act">复制</span></button></p>
        <div class="foot-share">
          <button class="share-btn sm" type="button" data-share-copy>复制本站链接</button>
          <button class="share-btn sm" type="button" data-share-qr aria-expanded="false" aria-controls="footQr">分享二维码</button>
        </div>
        <div class="share-qr foot-qr" id="footQr" hidden>
          <img src="${UP}assets/qr-site.svg" alt="扫码打开 ${SITE_NAME}" width="148" height="148" loading="lazy">
          <p>扫码打开本站，转发给朋友</p>
        </div>
      </div>
      <nav class="foot-nav" aria-label="页脚导航">
        <a href="${UP}board/">留言板</a>
      </nav>
    </div>
    <div class="foot-bottom">
      <span class="foot-hits" id="busuanzi_container_site_pv" style="display:none">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/></svg>
        本站总访问量 <b id="busuanzi_value_site_pv">-</b> 次 · 访客 <b id="busuanzi_value_site_uv">-</b> 人
      </span>
      <span>本站为玩家整理向攻略站，非官方站点。游戏名称与画面版权归原厂商所有。</span>
      <span>具体数值、机制与活动以游戏内为准</span>
      <span>界面组件改编自 <a href="https://uiverse.io" target="_blank" rel="noopener">Uiverse.io</a> 开源组件（MIT）：Afacanc38、Bodyhc</span>
    </div>
  </div>
</footer>`;
}

function tabbar() {
  return `<nav class="tabbar" aria-label="底部导航">
  <a href="${UP}" class="tab" data-tab="home">
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>
    <span>首页</span>
  </a>
  <a href="${UP}#library" class="tab" data-tab="guides">
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    <span>攻略</span>
  </a>
  <a href="${UP}#games" class="tab" data-tab="games">
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 12h4m-2-2v4m7-3h.01M18 10h.01"/><rect x="2" y="6" width="20" height="12" rx="6"/></svg>
    <span>游戏</span>
  </a>
</nav>`;
}

/* 复制客服号 + 滚动进度：静态页只带这一小段脚本 */
const PAGE_SCRIPT = `<script>
(function(){
  var bar = document.getElementById('progress');
  function onScroll(){
    var h = document.body.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  var tabs = document.querySelectorAll('.tabbar .tab');
  function setActive(){
    var i = 0; tabs.forEach(function(t, n){ if (t.dataset.tab === 'guides') i = n; });
    tabs.forEach(function(t){ t.classList.remove('active'); });
    if (tabs[i]) tabs[i].classList.add('active');
  }
  setActive();
  function legacyCopy(text){
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false; try { ok = document.execCommand('copy'); } catch(e) {}
    ta.remove(); return ok;
  }
  function copyText(text){
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function(){ return true; }).catch(function(){ return legacyCopy(text); });
    return Promise.resolve(legacyCopy(text));
  }
  var timer = 0;
  function toast(msg){
    var el = document.getElementById('uToast'); if (!el) return;
    el.querySelector('.u-text').textContent = msg;
    el.classList.add('show'); clearTimeout(timer);
    timer = setTimeout(function(){ el.classList.remove('show'); }, 2400);
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-copy]'); if (!btn) return;
    var act = btn.querySelector('.cs-act'); if (!act) return;
    var original = act.textContent, code = btn.getAttribute('data-copy');
    copyText(code).then(function(ok){
      act.textContent = ok ? '已复制' : '请手动复制';
      toast(ok ? '已复制：游戏客服 ' + code : '复制被浏览器拦下，请手动选中 ' + code);
      setTimeout(function(){ act.textContent = original; }, 1800);
    });
  });
})();
</script>
<script>/* ---------- 首屏落点：刷新或重新进入一律从顶部开始 ----------
   浏览器默认会恢复上次的滚动位置，长文章一进来就停在半路会让人以为页面错乱；
   带小节锚点（点过标题旁的 # 复制链接）时尊重锚点，不做干预 */
(function(){
  var navType = '';
  try { navType = (performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) {}
  if (navType === 'back_forward') return;
  var id = location.hash.slice(1);
  if (id && document.getElementById(id)) return;
  var touched = false;
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function(ev){
    window.addEventListener(ev, function(){ touched = true; }, { passive: true, once: true });
  });
  function toTop(){ if (!touched && window.scrollY) window.scrollTo(0, 0); }
  toTop();
  if (window.requestAnimationFrame) requestAnimationFrame(toTop);
  window.addEventListener('load', toTop, { once: true });
})();
</script>`;

/* Cloudflare Web Analytics：账户面板生成的 beacon token，全站页面统一注入 */
const CF_BEACON = '<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "633cfde81fda41078f9b04e89ba0ea4e"}\'></script><!-- End Cloudflare Web Analytics -->';

/* 站长平台验证码：build/seo.json 里填哪个，就在所有页面输出对应 meta；留空不输出 */
const SEO_VERIFY = (() => {
  try { return JSON.parse(fs.readFileSync('build/seo.json', 'utf8')); } catch (e) { return {}; }
})();
const VERIFY_META = (() => {
  const NAME = {
    google: 'google-site-verification',
    bing: 'msvalidate.01',
    baidu: 'baidu-site-verification',
    sogou: 'sogou_site_verification',
    so360: '360-site-verification'
  };
  return Object.keys(NAME)
    .filter(k => SEO_VERIFY[k])
    .map(k => `<meta name="${NAME[k]}" content="${esc(String(SEO_VERIFY[k]))}">`)
    .join('\n');
})();

function page({ title, desc, canonical, jsonld, body, ogImage, ogType = 'article', bodyClass = '', guideId = '', headExtra = '', noData = false }) {
  const dsc = clipDesc(desc || '');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>/* 落点控制：刷新/新进入不恢复上次的滚动位置（前进后退仍交给浏览器） */
(function(){try{var n=performance.getEntriesByType('navigation')[0];var t=n&&n.type;if(t!=='back_forward'&&'scrollRestoration' in history)history.scrollRestoration='manual';}catch(e){}})();</script>
<script>/* 旧域名过渡：仅在 GitHub Pages 的副本上生效，正式域名不受影响 */
(function(){var h=location.hostname;if(!/(^|\\.)github\\.io$/.test(h))return;var p=location.pathname.replace(/^\\/gonglue-tai(?=\\/|$)/,'')||'/';location.replace('${SITE_ORIGIN}'+p+location.search+location.hash);})();</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(dsc)}">
${/noindex/.test(headExtra) ? '' : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">\n'}${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
${VERIFY_META ? VERIFY_META + '\n' : ''}<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} · 最新更新" href="${SITE}feed.xml">
<meta name="theme-color" content="#090A12">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="zh_CN">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(dsc)}">
<meta property="og:url" content="${canonical || SITE}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(dsc)}">
<meta name="twitter:image" content="${ogImage}">
${ogType === 'article' ? `<meta property="article:published_time" content="${GDATE(guideId)}T08:00:00+08:00">
<meta property="article:modified_time" content="${GDATE(guideId)}T08:00:00+08:00">` : ''}
${PRECONNECT}
<link rel="icon" type="image/svg+xml" href="${UP}assets/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="${UP}assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="${UP}assets/favicon-16.png">
<link rel="manifest" href="${UP}assets/manifest.webmanifest">
<link rel="apple-touch-icon" href="${UP}assets/apple-touch-icon.png">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="攻略大全">
<link rel="stylesheet" href="${UP}assets/style.css">
<script type="application/ld+json">${jsonld}</script>
${CF_BEACON}
${headExtra}
</head>
<body${bodyClass ? ' class="' + bodyClass + '"' : ''}${guideId ? ' data-guide-id="' + guideId + '"' : ''}>
<a class="skip" href="#main">跳到主内容</a>
<div class="progress" id="progress" aria-hidden="true"></div>
${topbar()}
<main class="view" id="main" tabindex="-1">
${body}
</main>
${footer()}
${tabbar()}
<div class="u-toast" id="uToast" role="status" aria-live="polite"><span class="u-dot" aria-hidden="true"></span><span class="u-text"></span></div>
${(guideId || noData) ? '' : '<script src="' + UP + 'assets/data.js"></script>'}
<script src="${UP}assets/ui.js"></script>
${PAGE_SCRIPT}
<script async src="https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>
</body>
</html>
`;
}

/* ---------- 攻略页 ---------- */
/* 分享区块：复制链接 / 微信扫码 / 微博 / QQ / 系统分享 */
function shareBlock(gi) {
  const url = SITE + 'a/' + gi.id + '/';
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(gi.title + ' · ' + SITE_NAME);
  const hasQr = fs.existsSync(path.join('a', gi.id, 'qr.svg'));
  return `  <section class="share" aria-label="分享这篇攻略">
    <p class="share-t">这篇有用？转给一起玩的人</p>
    <div class="share-row">
      <button class="share-btn" type="button" data-share-copy>复制链接</button>
      ${hasQr ? '<button class="share-btn" type="button" data-share-qr aria-expanded="false" aria-controls="shareQr">微信扫码</button>' : ''}
      <a class="share-btn" href="https://service.weibo.com/share/share.php?url=${u}&title=${t}" target="_blank" rel="noopener nofollow">微博</a>
      <a class="share-btn" href="https://connect.qq.com/widget/shareqq/index.html?url=${u}&title=${t}" target="_blank" rel="noopener nofollow">QQ</a>
      <button class="share-btn" type="button" data-share-native hidden>系统分享</button>
    </div>
    ${hasQr ? `<div class="share-qr" id="shareQr" hidden>
      <img src="qr.svg" alt="扫码在手机上打开《${esc(gi.title)}》" width="148" height="148" loading="lazy">
      <p>微信扫一扫，手机上继续看</p>
    </div>` : ''}
  </section>
`;
}

function articlePage(gi) {
  const game = GAMES[gi.game];
  const url = SITE + 'a/' + gi.id + '/';
  const img = SITE + HERO[gi.game];
  const sameGame = GUIDES.filter(x => x.game === gi.game && x.id !== gi.id);
  const pos = sameGame.findIndex(x => x.id === gi.id);
  const related = sameGame.concat(GUIDES.filter(x => x.game !== gi.game)).slice(0, 3);

  const all = ORDER.map(k => GUIDES.filter(x => x.game === k)).flat();
  const flatIdx = all.findIndex(x => x.id === gi.id);
  const prev = flatIdx > 0 ? all[flatIdx - 1] : null;
  const next = flatIdx < all.length - 1 ? all[flatIdx + 1] : null;

  const title = seoTitle(gi.title, gi.game);
  const desc = seoDesc(gi);

  const jsonld = escJson({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: gi.title,
        description: desc,
        inLanguage: 'zh-CN',
        image: [img],
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        datePublished: gdate(gi),
        dateModified: gdate(gi),
        articleSection: CATS[gi.cat],
        keywords: [game.name, CATS[gi.cat], gi.level, '游戏攻略'].join(','),
        author: { '@type': 'Organization', name: SITE_NAME },
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: SITE + 'assets/icon-512.png' } }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE },
          { '@type': 'ListItem', position: 2, name: game.name, item: SITE + 'g/' + gi.game + '/' },
          { '@type': 'ListItem', position: 3, name: gi.title, item: url }
        ]
      }
    ]
  });

  const navPair = [
    prev ? `<a href="../${prev.id}/"><span class="np-k">上一篇</span><span class="np-t">${esc(prev.title)}</span></a>` : '<span></span>',
    next ? `<a href="../${next.id}/"><span class="np-k">下一篇</span><span class="np-t">${esc(next.title)}</span></a>` : '<span></span>'
  ].join('');

  /* 正文小节加锚点，供目录跳转 */
  let hi = 0;
  const bodyHTML = gi.blocks.map(b => {
    if (b.t === 'h') { hi += 1; return '<h2 id="s' + hi + '">' + esc(b.v) + '</h2>'; }
    return blockHTML(b, UP);
  }).join('');
  const heads = gi.blocks.filter(b => b.t === 'h');
  const tocHTML = heads.length >= 3
    ? '<nav class="toc" aria-label="本文目录"><p class="toc-h">本文目录<span class="toc-n"></span></p><ol>'
      + heads.map((b, i) => '<li><a href="#s' + (i + 1) + '">' + esc(b.v) + '</a></li>').join('')
      + '</ol></nav>'
    : '';


  const body = `<div class="wrap">
<article class="article" style="--ac:${game.accent}">
  <nav class="crumb" aria-label="面包屑">
    <a href="${UP}">首页</a><i>/</i><span>${esc(game.name)}</span><i>/</i><span>${esc(CATS[gi.cat])}</span>
  </nav>
  <div class="a-accent"></div>
  <div class="a-meta"><span>${esc(game.name)}</span><i class="divider"></i><span>${esc(CATS[gi.cat])}</span><i class="divider"></i><span>${esc(gi.level)}</span><i class="divider"></i><span>${IDX[gi.id]} 号</span></div>
  <h1 class="a-title">${esc(gi.title)}</h1>
  <p class="a-dek">${esc(gi.dek)}</p>
  <div class="a-foot">
    <span>阅读约 ${readMin(gi)} 分钟</span><span>${sectionsOf(gi)} 节</span><span>更新于 ${gdate(gi)}</span>
    <button class="book-btn" type="button" data-book="${gi.id}" aria-pressed="false" title="收藏这篇攻略">收藏</button>
    <div class="fs-ctrl" role="group" aria-label="正文字号">
      <button type="button" data-fs="s" aria-pressed="false" title="小号字">A−</button>
      <button type="button" data-fs="m" aria-pressed="true" title="标准字号">A</button>
      <button type="button" data-fs="l" aria-pressed="false" title="大号字">A+</button>
    </div>
  </div>
  <section class="takeaways"><h2>先看结论</h2><ul>${gi.take.map(t => '<li>' + esc(t) + '</li>').join('')}</ul></section>
  ${tocHTML}
  <div class="prose">${bodyHTML}</div>
  <section class="cta-line">
    <div><b>要开服信息或进本区？</b><span>客服号 ${CS}，复制后搜索添加。</span></div>
    <button class="cs-pill" type="button" data-copy="${CS}"><b>游戏客服 ${CS}</b><span class="cs-act">复制</span></button>
  </section>
  ${shareBlock(gi)}
  <nav class="navpair" aria-label="翻页">${navPair}</nav>
  <section class="related"><h2>接着看</h2>
    ${related.map(x => `<a href="../${x.id}/"><span class="rel-t">${esc(x.title)}</span><span class="rel-g">${esc(GAMES[x.game].name)}</span></a>`).join('')}
  </section>
  ${(() => {
    const relIds = related.map(x => x.id);
    const moreSame = sameGame.filter(x => !relIds.includes(x.id));
    if (!moreSame.length) return '';
    return `<nav class="more-g" aria-label="${esc(game.name)}其他攻略"><h2>${esc(game.name)} · 其他攻略</h2><ul>${moreSame.map(x => `<li><a href="../${x.id}/">${esc(x.title)}</a></li>`).join('')}</ul></nav>`;
  })()}
  <div class="a-end">
    <a class="back" href="${UP}#library">← 返回攻略库</a>
    <a class="back" href="${UP}g/${game.id}/">看 ${esc(game.name)} 全部攻略</a>
  </div>
</article>
</div>`;

  return { path: path.join('a', gi.id, 'index.html'), html: page({ title, desc, canonical: url, jsonld, body, ogImage: img, guideId: gi.id }) };
}

/* ---------- 首页注入：社交卡片 / 结构化数据 / 无脚本目录 ---------- */
const HOME_DESC = '露娜2：拾光之约、桃园：将帅录、贰点零江湖、小小屠龙 · 冰雪传奇、英雄连城 · 奇迹MU的开荒路线、职业选择、魔附养成、打金交易与团战站位，都整理成能直接照着做的步骤，按游戏和分类就能查到。';
const HOME_TITLE = '游戏攻略大全 · 贰点零江湖 / 小小屠龙 · 冰雪传奇 / 桃园：将帅录 / 露娜2：拾光之约 / 英雄连城 · 奇迹MU';

function homeHead() {
  const jsonld = escJson({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: SITE_NAME, alternateName: '游戏攻略总站', url: SITE, inLanguage: 'zh-CN' },
      { '@type': 'Organization', name: SITE_NAME, url: SITE, logo: { '@type': 'ImageObject', url: SITE + 'assets/icon-512.png' } },
      {
        '@type': 'ItemList',
        name: '游戏攻略目录',
        numberOfItems: GUIDES.length,
        itemListElement: GUIDES.map((gi, i) => ({ '@type': 'ListItem', position: i + 1, name: gi.title, url: SITE + 'a/' + gi.id + '/' }))
      }
    ]
  });
  return `<meta name="theme-color" content="#090A12">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="${SITE}">
${VERIFY_META ? VERIFY_META + '\n' : ''}<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} · 最新更新" href="${SITE}feed.xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="zh_CN">
<meta property="og:title" content="${esc(HOME_TITLE)}">
<meta property="og:description" content="${esc(HOME_DESC)}">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}${HERO.ty}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(HOME_TITLE)}">
<meta name="twitter:description" content="${esc(HOME_DESC)}">
<meta name="twitter:image" content="${SITE}${HERO.ty}">
${PRECONNECT}
<script type="application/ld+json">${jsonld}</script>
${CF_BEACON}`;
}

function homeNoScript() {
  return `<noscript>
      <div class="nojs-list">
        <p class="nojs-title">攻略目录（共 ${GUIDES.length} 篇）</p>
        <ul>
${ORDER.map(k => GUIDES.filter(x => x.game === k).map(gi => `          <li><a href="a/${gi.id}/">${esc(gi.title)}</a><span>${esc(GAMES[k].name)} · ${esc(CATS[gi.cat])}</span></li>`).join('\n')).join('\n')}
        </ul>
      </div>
    </noscript>`;
}

/* ---------- 分站静态页 ----------
   分站内容原本只在首页 #/g/<key> 里，靠前端渲染 —— 搜索引擎看不到，也没法单独分享。
   这里把首页那段真实标记原样抽出来（单一数据来源，不重复维护），落成 /g/<key>/ 静态页。 */
const GAME_IMG = { ejl: 'assets/ejl-hero.jpg', xxtl: 'assets/xxtl-siege.jpg', ty: 'assets/ty-key.jpg', luna2: 'assets/luna2-hero.jpg', yxlc: 'assets/yxlc-hero.jpg' };

function gameBlock(key) {
  const html = fs.readFileSync('index.html', 'utf8');
  const start = html.indexOf('<section class="game-page" data-game="' + key + '"');
  if (start < 0) throw new Error('找不到分站区块：' + key);
  const re = /<section\b|<\/section>/g;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0] === '</section>') {
      depth -= 1;
      if (depth === 0) return html.slice(start, re.lastIndex);
    } else depth += 1;
  }
  throw new Error('分站区块未闭合：' + key);
}

/* 与首页 entryHTML 保持同样的卡片结构（去掉依赖本地存储的已读/收藏标记） */
function gameEntry(gi) {
  const game = GAMES[gi.game];
  return `<a class="entry" href="../../a/${gi.id}/" style="--ac:${game.accent}">`
    + `<span class="entry-tab" title="${esc(game.name)}" aria-label="${esc(game.name)}">${esc(game.short)}<i>${IDX[gi.id]}</i></span>`
    + `<span class="entry-body">`
    + `<span class="entry-meta"><span>${esc(game.name)}</span><i class="divider"></i><span>${esc(CATS[gi.cat])}</span><i class="divider"></i><span>${esc(gi.level)}</span></span>`
    + `<span class="entry-title">${esc(gi.title)}</span>`
    + `<span class="entry-dek">${esc(gi.dek)}</span>`
    + `<span class="entry-foot">阅读约 ${readMin(gi)} 分钟 · ${sectionsOf(gi)} 节 · 更新于 ${gdate(gi)}</span>`
    + `</span></a>`;
}

function gamePage(key) {
  const game = GAMES[key];
  const list = GUIDES.filter(g => g.game === key);
  const home = SITE;
  const canonical = SITE + 'g/' + key + '/';

  let body = gameBlock(key);
  /* 首页里三个分站视图的标题是 h2（首页只留一个 h1），单独落地页则要把它升回页面唯一的 h1 */
  body = body.replace(/<h2 class="game-h">([\s\S]*?)<\/h2>/, '<h1 class="game-h">$1</h1>');
  /* 静态页没有前端脚本填内容，这里直接铺好 */
  body = body.replace(' data-game="' + key + '" hidden>', ' data-game="' + key + '">');
  body = body.replace(new RegExp('<span data-count="' + key + '" data-count-fmt="\\{n\\}">\\d+</span>', 'g'), '<span data-count="' + key + '">' + list.length + '</span>');
  body = body.replace('<div class="entries" data-entries="' + key + '"></div>', '<div class="entries">' + list.map(gameEntry).join('') + '</div>');
  /* 站内 hash 路由换成真实地址 */
  body = body.replace(/href="#\/a\/([a-z-]+)"/g, 'href="../../a/$1/"');
  body = body.replace(/href="#\/g\/([a-z]+)"/g, 'href="../$1/"');
  body = body.replace(/href="#\/" data-goto="library"/g, 'href="../../#library"');
  body = body.replace(/href="#\/"/g, 'href="../../"');
  /* 图片原本相对站点根，搬到 /g/<key>/ 后要回两级 */
  body = body.replace(/"assets\//g, '"../../assets/').replace(/, assets\//g, ', ../../assets/');
  /* 静态分站页没有「隐藏视图」这回事，hero 图就是首屏 LCP：
     首页为了省带宽给它加了 lazy，落地页要还原成 eager 并提高抓取优先级
     （.art 可能是普通大图，也可能是 .art.hero-carousel 轮播，只动第一张） */
  body = body.replace(/(<div class="art[^"]*"[^>]*>)([\s\S]*?<\/picture>)/, (m, open, inner) =>
    open + inner.replace(' loading="lazy"', '').replace('<img ', '<img fetchpriority="high" '));

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: game.name + ' 攻略',
        description: game.name + '（' + game.tag + '）的攻略合集，共 ' + list.length + ' 篇。',
        url: canonical,
        inLanguage: 'zh-CN',
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: home }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: home },
          { '@type': 'ListItem', position: 2, name: game.name, item: canonical }
        ]
      },
      {
        '@type': 'ItemList',
        name: game.name + ' 攻略目录',
        numberOfItems: list.length,
        itemListElement: list.map((gi, i) => ({ '@type': 'ListItem', position: i + 1, name: gi.title, url: SITE + 'a/' + gi.id + '/' }))
      }
    ]
  });

  /* /g/<key>/ 与攻略页同样深两层，资产回根目录用 ../../ */
  UP = '../../';
  const html = page({
    title: game.name + '攻略 · ' + game.tag,
    desc: game.name + '（' + game.tag + '）的 ' + list.length + ' 篇攻略：开荒路线、职业选择、打金交易、团战攻沙，都写成可以直接照着做的步骤。',
    canonical,
    jsonld,
    ogImage: SITE + GAME_IMG[key],
    ogType: 'website',
    bodyClass: 'view-game',
    noData: true,
    body
  });
  UP = '../../';
  return { key, path: 'g/' + key + '/index.html', html };
}

function boardPage() {
  UP = '../';
  const canonical = SITE + 'board/';
  const jsonld = escJson({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: '留言板', url: canonical, inLanguage: 'zh-CN', isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE } },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: SITE },
          { '@type': 'ListItem', position: 2, name: '留言板', item: canonical }
        ]
      }
    ]
  });
  const html = page({
    title: '留言板 · ' + SITE_NAME,
    desc: '玩到哪儿卡住了、哪条攻略真帮上忙、想让我多写哪款游戏——都可以在这里留下。不用注册，填个昵称就能发，看到有意思的留言我会回。',
    canonical,
    jsonld,
    ogImage: SITE + HERO.ty,
    ogType: 'website',
    bodyClass: 'page-board',
    noData: true,
    body: `<div class="wrap">
  <section class="board" aria-labelledby="bdTitle">
    <div class="board-head">
      <h1 id="bdTitle">留言板</h1>
      <p>玩到哪儿卡住了、哪条攻略真帮上忙、想让我多写哪款游戏——都可以写在这里。不用注册，填个昵称就能发（留空就是「匿名玩家」）。</p>
    </div>
    <form class="board-form" id="bdForm" novalidate>
      <div class="bd-field">
        <label class="bd-label" for="bdName">昵称（可留空）</label>
        <input class="bd-input" id="bdName" name="name" type="text" maxlength="16" placeholder="匿名玩家" autocomplete="nickname">
      </div>
      <div class="bd-field">
        <label class="bd-label" for="bdBody">想说的话</label>
        <textarea class="bd-area" id="bdBody" name="body" maxlength="300" required placeholder="例如：小小屠龙 · 冰雪传奇 攻沙那篇的卡点路线帮我过了第一次团战，感谢。"></textarea>
      </div>
      <div class="bd-foot">
        <span class="bd-count" id="bdCount">0 / 300</span>
        <button class="bd-send" type="submit" id="bdSend">发布留言</button>
      </div>
      <p class="bd-msg" id="bdMsg" role="status" aria-live="polite"></p>
      <p class="bd-off" id="bdOff" hidden>留言板暂时连不上服务器，攻略内容不受影响，稍后再来试试。</p>
    </form>
    <ul class="bd-list" id="bdList" aria-label="最新留言" aria-live="polite"></ul>
    <p class="bd-loading" id="bdLoading">正在加载留言…</p>
    <p class="bd-empty" id="bdEmpty" hidden>还没有留言，你可以说第一句。</p>
    <button class="bd-more" type="button" id="bdMore" hidden>加载更早的留言</button>
  </section>
</div>`
  });
  UP = '../../';
  return html;
}

/* ---------- 404：失效链接落在这里，直接把全部攻略摊开，别让人走进死胡同 ---------- */
function notFoundPage() {
  const groups = ORDER.map(k => {
    const items = GUIDES.filter(g => g.game === k);
    return `      <div class="nf-g">
        <p class="nf-g-name">${esc(GAMES[k].name)}</p>
        <ul>${items.map(gi => `<li><a href="/a/${gi.id}/">${esc(gi.title)}</a></li>`).join('')}</ul>
      </div>`;
  }).join('\n');

  UP = '/';
  const html = page({
    title: `页面不存在 · ${SITE_NAME}`,
    desc: `这个地址没有对应内容。站内 ${GUIDES.length} 篇攻略按游戏列在这里，也可以直接搜标题。`,
    canonical: '',
    jsonld: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '页面不存在',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE }
    }),
    ogImage: SITE + HERO.ty,
    ogType: 'website',
    bodyClass: 'page-404',
    headExtra: '<meta name="robots" content="noindex, follow">',
    noData: true,
    body: `<div class="wrap">
  <section class="nf">
    <p class="nf-code">404 · 页面不存在</p>
    <h1>这个页面走丢了</h1>
    <p>链接可能已经失效，或者地址打错了一个字符。下面是站内全部 ${GUIDES.length} 篇攻略，按游戏分开列着；也可以用右上角的搜索（⌘K / Ctrl+K）直接搜标题。</p>
    <div class="nf-acts">
      <a class="nf-btn primary" href="/">回首页</a>
      <a class="nf-btn" href="/#library">看攻略库</a>
      <a class="nf-btn" href="/#games">按游戏挑</a>
    </div>
    <div class="nf-list">
      <h2>全部攻略</h2>
${groups}
    </div>
  </section>
</div>`
  });
  UP = '../../';
  return html;
}

function inject(file, marker, content) {
  const re = new RegExp('(<!-- ' + marker + ' -->)[\\s\\S]*?(<!-- /' + marker + ' -->)');
  const html = fs.readFileSync(file, 'utf8');
  if (!re.test(html)) throw new Error('marker not found: ' + marker);
  fs.writeFileSync(file, html.replace(re, '$1\n' + content + '\n$2'), 'utf8');
}

inject('index.html', 'BUILD:HEAD', homeHead());
inject('index.html', 'BUILD:NOSCRIPT', homeNoScript());


const files = [];
GUIDES.forEach(gi => files.push(articlePage(gi)));
ORDER.forEach(k => files.push(gamePage(k)));

files.forEach(f => {
  fs.mkdirSync(path.dirname(f.path), { recursive: true });
  fs.writeFileSync(f.path, f.html, 'utf8');
});

fs.mkdirSync('board', { recursive: true });
fs.writeFileSync('board/index.html', boardPage(), 'utf8');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${SITE_LASTMOD}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
${ORDER.map(k => `  <url><loc>${SITE}g/${k}/</loc><lastmod>${SITE_LASTMOD}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`).join('\n')}
  <url><loc>${SITE}board/</loc><lastmod>${SITE_LASTMOD}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>
${GUIDES.map(gi => `  <url><loc>${SITE}a/${gi.id}/</loc><lastmod>${gdate(gi)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync('sitemap.xml', sitemap, 'utf8');

/* ---------- RSS 2.0 订阅源 ----------
 * 按更新日期倒序取最近 30 篇，pubDate 用文章日期（北京时间 08:00），
 * 描述取「一句话结论」dek，读者在阅读器里就能判断要不要点进来
 */
const RSS_LIMIT = 30;
const rfc822 = d => new Date(d + 'T08:00:00+08:00').toUTCString();
const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const feedItems = [...GUIDES]
  .sort((a, b) => (gdate(b) + 'Z' + b.id).localeCompare(gdate(a) + 'Z' + a.id))
  .slice(0, RSS_LIMIT);
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xesc(SITE_NAME)}</title>
  <link>${SITE}</link>
  <description>${xesc(HOME_DESC)}</description>
  <language>zh-cn</language>
  <lastBuildDate>${rfc822(SITE_LASTMOD)}</lastBuildDate>
  <generator>build.mjs</generator>
  <atom:link href="${SITE}feed.xml" rel="self" type="application/rss+xml"/>
${feedItems.map(gi => `  <item>
    <title>${xesc(gi.title)}</title>
    <link>${SITE}a/${gi.id}/</link>
    <guid isPermaLink="true">${SITE}a/${gi.id}/</guid>
    <category>${xesc(GAMES[gi.game].name)}</category>
    <pubDate>${rfc822(gdate(gi))}</pubDate>
    <description>${xesc(gi.dek)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`;
fs.writeFileSync('feed.xml', feed, 'utf8');

/* 前端日期表：SPA 列表卡片运行时渲染用（静态分站页构建时直接取 DATES） */
fs.writeFileSync('assets/dates.js', 'window.GL_DATES=' + JSON.stringify(Object.fromEntries(GUIDES.map(gi => [gi.id, gdate(gi)]))) + ';\n', 'utf8');

fs.writeFileSync('404.html', notFoundPage(), 'utf8');

fs.writeFileSync('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}sitemap.xml\n`, 'utf8');

/* ---------- Service Worker（离线缓存）----------
 * 由 build/sw.template.js 生成：版本号取「关键资源内容」的指纹，
 * 样式/脚本/数据任一变动，版本就变，老缓存随之作废，不会出现「改了但用户还看旧版」 */
const SW_TEMPLATE = fs.readFileSync(path.join(import.meta.dirname, 'sw.template.js'), 'utf8');
const swHash = crypto.createHash('sha1')
  .update(fs.readFileSync('assets/style.css'))
  .update(fs.readFileSync('assets/ui.js'))
  .update(fs.readFileSync('assets/data.js'))
  .update(fs.readFileSync('assets/dates.js'))
  .update(fs.readFileSync('assets/favicon.svg'))
  .update(fs.readFileSync('offline.html'))
  .update(SW_TEMPLATE)
  .digest('hex').slice(0, 10);
fs.writeFileSync('sw.js', SW_TEMPLATE.replace('__VERSION__', swHash), 'utf8');

console.log('生成攻略页：' + GUIDES.length + ' 篇 · 分站页：' + ORDER.length + ' 个 · 404.html / sitemap.xml / robots.txt / feed.xml 已更新');
