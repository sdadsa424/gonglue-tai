/**
 * 静态攻略页构建：把 assets/data.js 里的攻略预渲染成真实 URL 的 HTML
 * 产出：a/<id>/index.html × N、sitemap.xml、robots.txt
 * 用法：node build/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GAMES, CATS, GUIDES } = require('../assets/data.js');

const SITE = 'https://sdadsa424.github.io/gonglue-tai/';
const SITE_NAME = '游戏攻略大全';
const UPDATED = '2026-11-05';
const ORDER = ['ejl', 'xxtl', 'ty'];
const CS = 'ggboy6123';

const HERO = { ejl: 'assets/hero-ejl.jpg', xxtl: 'assets/hero-xxtl.jpg', ty: 'assets/hero-ty.jpg' };
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230B0D16'/%3E%3Crect x='5' y='5' width='5' height='22' fill='%23FF3D9A'/%3E%3Cg fill='%23ECEEEA'%3E%3Crect x='15' y='7' width='12' height='2'/%3E%3Crect x='15' y='14' width='12' height='2'/%3E%3Crect x='15' y='21' width='8' height='2'/%3E%3C/g%3E%3C/svg%3E";

/* ---------- 工具 ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escJson = s => JSON.stringify(s).replace(/</g, '\\u003c');

const IDX = {};
ORDER.forEach(k => {
  let n = 0;
  GUIDES.filter(x => x.game === k).forEach(x => { n += 1; IDX[x.id] = String(n).padStart(2, '0'); });
});

function guideText(gi) {
  let s = gi.title + gi.dek + gi.take.join('');
  gi.blocks.forEach(b => {
    if (b.t === 'table') s += b.head.join('') + b.rows.map(r => r.join('')).join('');
    else if (Array.isArray(b.v)) s += b.v.join('');
    else s += b.v;
  });
  return s;
}
const readMin = gi => Math.max(2, Math.round(guideText(gi).length / 300));
const sectionsOf = gi => gi.blocks.filter(b => b.t === 'h').length;

function blockHTML(b) {
  if (b.t === 'h') return '<h2>' + esc(b.v) + '</h2>';
  if (b.t === 'p') return '<p>' + esc(b.v) + '</p>';
  if (b.t === 'note') return '<p class="note">' + esc(b.v) + '</p>';
  if (b.t === 'ul') return '<ul>' + b.v.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
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

/* 攻略页里的相对层级固定为 a/<id>/ → 回到站点根用 ../../ */
const UP = '../../';

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
  </div>
</header>`;
}

function footer(activeGame) {
  return `<footer class="foot">
  <div class="wrap">
    <div class="foot-in">
      <div>
        <p class="foot-name">${SITE_NAME}</p>
        <p>一个玩家整理的攻略站，把三款游戏里真正会用到的判断写成条目：什么时候走、什么时候留、什么该卖、什么该留。站内文章按游戏与阶段索引，持续补充。</p>
        <p class="foot-cs">获取游戏与开服信息：<button class="cs-pill dark" type="button" data-copy="${CS}"><b>游戏客服 ${CS}</b><span class="cs-act">复制</span></button></p>
      </div>
      <nav class="foot-nav" aria-label="页脚导航">
        <a href="${UP}#library">攻略库</a>
        <a href="${UP}#route">开荒路线</a>
        <a href="${UP}#games">游戏</a>
        <a href="${UP}#/g/ejl">贰点零江湖</a>
        <a href="${UP}#/g/xxtl">小小屠龙</a>
        <a href="${UP}#/g/ty">桃园：将帅录</a>
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
</script>`;

function page({ title, desc, canonical, jsonld, body, ogImage, ogType = 'article', bodyClass = '', guideId = '' }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#090A12">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="zh_CN">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="${UP}assets/style.css">
<script type="application/ld+json">${jsonld}</script>
</head>
<body${bodyClass ? ' class="' + bodyClass + '"' : ''}${guideId ? ' data-guide-id="' + guideId + '"' : ''}>
<div class="progress" id="progress" aria-hidden="true"></div>
${topbar()}
<main class="view">
${body}
</main>
${footer()}
${tabbar()}
<div class="u-toast" id="uToast" role="status" aria-live="polite"><span class="u-dot" aria-hidden="true"></span><span class="u-text"></span></div>
<script src="${UP}assets/ui.js"></script>
${PAGE_SCRIPT}
<script async src="https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>
</body>
</html>
`;
}

/* ---------- 攻略页 ---------- */
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

  const title = gi.title + ' · ' + game.name + '攻略 · ' + SITE_NAME;
  const desc = gi.dek.length > 118 ? gi.dek.slice(0, 116) + '…' : gi.dek;

  const jsonld = escJson({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: gi.title,
        description: gi.dek,
        inLanguage: 'zh-CN',
        image: [img],
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        datePublished: UPDATED,
        dateModified: UPDATED,
        articleSection: CATS[gi.cat],
        keywords: [game.name, CATS[gi.cat], gi.level, '游戏攻略'].join(','),
        author: { '@type': 'Organization', name: SITE_NAME },
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: SITE + HERO.ejl } }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE },
          { '@type': 'ListItem', position: 2, name: game.name, item: SITE + '#/g/' + gi.game },
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
    return blockHTML(b);
  }).join('');
  const heads = gi.blocks.filter(b => b.t === 'h');
  const tocHTML = heads.length >= 3
    ? '<nav class="toc" aria-label="本文目录"><p class="toc-h">本文目录</p><ol>'
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
    <span>阅读约 ${readMin(gi)} 分钟</span><span>${sectionsOf(gi)} 节</span><span>更新于 ${UPDATED}</span>
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
  <nav class="navpair" aria-label="翻页">${navPair}</nav>
  <section class="related"><h2>接着看</h2>
    ${related.map(x => `<a href="../${x.id}/"><span class="rel-t">${esc(x.title)}</span><span class="rel-g">${esc(GAMES[x.game].name)}</span></a>`).join('')}
  </section>
  <div class="a-end">
    <a class="back" href="${UP}#library">← 返回攻略库</a>
    <a class="back" href="${UP}#/g/${game.id}">看 ${esc(game.name)} 全部攻略</a>
  </div>
</article>
</div>`;

  return { path: path.join('a', gi.id, 'index.html'), html: page({ title, desc, canonical: url, jsonld, body, ogImage: img, guideId: gi.id }) };
}

/* ---------- 首页注入：社交卡片 / 结构化数据 / 无脚本目录 ---------- */
const HOME_DESC = '贰点零江湖、小小屠龙冰雪传奇、桃园：将帅录 的开荒路线、职业选择、打金交易与团战节奏，整理成能直接照着做的攻略。';
const HOME_TITLE = '游戏攻略大全 · 游戏攻略总站';

function homeHead() {
  const jsonld = escJson({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: SITE_NAME, alternateName: '游戏攻略总站', url: SITE, inLanguage: 'zh-CN' },
      { '@type': 'Organization', name: SITE_NAME, url: SITE, logo: { '@type': 'ImageObject', url: SITE + HERO.ejl } },
      {
        '@type': 'ItemList',
        name: '游戏攻略目录',
        numberOfItems: GUIDES.length,
        itemListElement: GUIDES.map((gi, i) => ({ '@type': 'ListItem', position: i + 1, name: gi.title, url: SITE + 'a/' + gi.id + '/' }))
      }
    ]
  });
  return `<meta name="theme-color" content="#090A12">
<link rel="canonical" href="${SITE}">
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
<script type="application/ld+json">${jsonld}</script>`;
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

files.forEach(f => {
  fs.mkdirSync(path.dirname(f.path), { recursive: true });
  fs.writeFileSync(f.path, f.html, 'utf8');
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${UPDATED}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
${GUIDES.map(gi => `  <url><loc>${SITE}a/${gi.id}/</loc><lastmod>${UPDATED}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync('sitemap.xml', sitemap, 'utf8');

fs.writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`, 'utf8');

console.log('生成攻略页：' + files.length + ' 篇 · sitemap.xml / robots.txt 已更新');
