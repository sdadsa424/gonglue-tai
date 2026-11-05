/* 交互回归：用 jsdom 跑首页与攻略页的真实 DOM
   需要 jsdom：npm i jsdom（或设 JSDOM_PATH 指向已安装的 jsdom 入口）
   用法：先起本地服务，再 node tools/dom-test.mjs
   JSDOM_PATH="file:///C:/domtest/node_modules/jsdom/lib/api.js" BASE="http://127.0.0.1:8766/" node tools/dom-test.mjs */
const { JSDOM, VirtualConsole } = await import(process.env.JSDOM_PATH || 'jsdom');

const BASE = process.env.BASE || 'http://127.0.0.1:8766/';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

function make(url, seed, opts) {
  opts = opts || {};
  return JSDOM.fromURL(url, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
      window.HTMLElement.prototype.scrollIntoView = function () { this.__scrolled = true; };
      window.scrollTo = function () {};
      Object.defineProperty(window, 'scrollY', { value: 900, writable: true });
      try { Object.keys(seed || {}).forEach(k => window.localStorage.setItem(k, seed[k])); } catch (e) {}
      if (opts.width) Object.defineProperty(window, 'innerWidth', { value: opts.width, writable: true });
      if (opts.pointerFine) window.matchMedia = q => ({ matches: q.indexOf('pointer') >= 0, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      if (opts.fetchStub) {
        window.__fetchCalls = [];
        window.fetch = url => {
          window.__fetchCalls.push(String(url));
          return opts.fetchStub(String(url));
        };
      }
      /* geolocation 桩：opts.geo = { lat, lon } 走成功，{ error: 1 } 走拒绝 */
      if (opts.geo) {
        Object.defineProperty(window.navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition(onOk, onErr) {
              setTimeout(() => {
                if (opts.geo.error) onErr({ code: opts.geo.error, message: 'stub' });
                else onOk({ coords: { latitude: opts.geo.lat, longitude: opts.geo.lon, accuracy: 30 } });
              }, 0);
            }
          }
        });
      }
      /* fxProbe：假 rect（越深越靠下）+ 立即回调的 IO，用来验证滚动入场类是否真的挂上 */
      if (opts.fxProbe) {
        window.Element.prototype.getBoundingClientRect = function () {
          let top = 0, n = this;
          while (n && n.nodeType === 1) { top += 420; n = n.parentElement; }
          return { top, left: 0, right: 300, bottom: top + 100, width: 300, height: 100, x: 0, y: top, toJSON() {} };
        };
        window.IntersectionObserver = class {
          constructor(cb) { this.cb = cb; this.els = []; }
          observe(el) {
            this.els.push(el);
            setTimeout(() => {
              if (this.els.indexOf(el) >= 0) this.cb([{ isIntersecting: true, target: el }], this);
            }, 0);
          }
          unobserve(el) { const i = this.els.indexOf(el); if (i >= 0) this.els.splice(i, 1); }
          disconnect() { this.els = []; }
        };
      }
    }
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

/* ---------- 首页 ---------- */
console.log('\n[首页]');
const home = await make(BASE, { gl_read_v1: '["ejl-start"]', gl_pos_v1: '{"ejl-start":60}', gl_book_v1: '["ejl-start","ty-war"]' });
await wait(700);
const hd = home.window.document;
const w = home.window;

ok('列表渲染 23 篇', hd.querySelectorAll('#entryList .entry').length === 23, String(hd.querySelectorAll('#entryList .entry').length));
ok('卡片指向真 URL', (hd.querySelector('#entryList .entry')?.getAttribute('href') || '').startsWith('a/'));
ok('注入了回到顶部按钮', !!hd.querySelector('.to-top'));
ok('图片走 picture + WebP', hd.querySelectorAll('picture source[type="image/webp"]').length >= 6, String(hd.querySelectorAll('picture source[type="image/webp"]').length));
ok('图片带宽度级 srcset', hd.querySelectorAll('picture source[srcset*="480w"], picture source[srcset*="960w"]').length >= 6,
  String(hd.querySelectorAll('picture source[srcset*="480w"], picture source[srcset*="960w"]').length));

const input = hd.getElementById('searchInput');
input.value = '转生';
input.dispatchEvent(new w.Event('input', { bubbles: true }));
await wait(80);
ok('搜索关键词高亮', hd.querySelectorAll('#entryList mark.hl').length > 0);
ok('搜索过滤生效', hd.querySelectorAll('#entryList .entry').length < 23);

input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(60);
ok('搜索历史写入', (JSON.parse(w.localStorage.getItem('gl_q_v1') || '[]'))[0] === '转生');
ok('历史胶囊渲染', hd.querySelectorAll('#qHist .q-chip').length === 1);

hd.getElementById('clearFilter').click();
await wait(80);
const readEntry = [...hd.querySelectorAll('#entryList .entry')].find(a => a.getAttribute('href') === 'a/ejl-start/');
ok('已读条目带 is-read', !!readEntry?.classList.contains('is-read'));
ok('已读徽标可见', !!readEntry?.querySelector('.entry-read'));
ok('卡片显示读到进度', /读到 60%/.test(readEntry?.textContent || ''), readEntry?.querySelector('.entry-foot')?.textContent);
ok('卡片显示收藏星标', !!readEntry?.querySelector('.entry-star'));

const onlyBook = hd.getElementById('onlyBook');
ok('收藏筛选入口可见且计数正确', !onlyBook.hidden && hd.getElementById('bookCount').textContent === '2',
  onlyBook.hidden + '/' + hd.getElementById('bookCount')?.textContent);
onlyBook.click();
await wait(80);
ok('只看收藏只剩 2 篇', hd.querySelectorAll('#entryList .entry').length === 2, String(hd.querySelectorAll('#entryList .entry').length));
ok('收藏筛选按钮为按下态', onlyBook.getAttribute('aria-pressed') === 'true');
hd.getElementById('clearFilter').click();
await wait(80);
ok('清除筛选恢复 23 篇', hd.querySelectorAll('#entryList .entry').length === 23);

/* 搜索面板（首页由 ⌘K 呼出） */
ok('搜索面板已注入', !!hd.querySelector('.pal') && !!hd.querySelector('.pal-input'));
ok('顶栏有搜索入口', !!hd.querySelector('[data-palette]'));
hd.querySelector('[data-palette]').click();
await wait(60);
ok('点顶栏入口打开面板', hd.querySelector('.pal').classList.contains('open'));
hd.querySelector('.pal').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

/* 页脚分享 */
ok('页脚有分享入口', !!hd.querySelector('.foot-share [data-share-copy]'));
const footQr = hd.getElementById('footQr');
hd.querySelector('.foot-share [data-share-qr]').click();
await wait(60);
ok('页脚二维码可展开', !!footQr && !footQr.hidden);
ok('页脚二维码指向站点版', /qr-site\.svg$/.test(footQr.querySelector('img')?.getAttribute('src') || ''));

/* 视觉特效：图片骨架 + 分站切换过渡 */
ok('非首屏图片挂了加载骨架', hd.querySelectorAll('picture.fx-holder').length > 0, String(hd.querySelectorAll('picture.fx-holder').length));

/* 视觉特效：首屏海报视差 */
const pyEl = hd.querySelector('.hero-games');
const pyVal = pyEl ? pyEl.style.getPropertyValue('--py') : '';
ok('首屏海报写入视差量', /^-?\d+(\.\d+)?%$/.test(pyVal) && Math.abs(parseFloat(pyVal)) <= 1.6, pyVal || '(空)');
const cssText = (await import('node:fs')).readFileSync('assets/style.css', 'utf8');
ok('视差样式作用在海报图上', /\.poster img\{[^}]*translate:0 var\(--py/.test(cssText));
hd.location.hash = '#/g/ejl';
await wait(260);
ok('分站视图带入场过渡', !!hd.getElementById('view-game') && hd.getElementById('view-game').classList.contains('view-enter'));
await wait(40);
hd.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
await wait(60);
ok('⌘K 打开面板', hd.querySelector('.pal').classList.contains('open'));
const palInput = hd.querySelector('.pal-input');
palInput.value = '转生';
palInput.dispatchEvent(new w.Event('input', { bubbles: true }));
await wait(160);
ok('面板按关键词出结果', hd.querySelectorAll('.pal-item').length > 0, String(hd.querySelectorAll('.pal-item').length));
ok('面板结果高亮关键词', hd.querySelectorAll('.pal mark').length > 0);
palInput.value = '';
palInput.dispatchEvent(new w.Event('input', { bubbles: true }));
await wait(160);
ok('收藏分组文案', /收藏/.test(hd.getElementById('palHint')?.textContent || ''), hd.getElementById('palHint')?.textContent);
hd.querySelector('.pal').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(60);
ok('ESC 关闭面板', !hd.querySelector('.pal').classList.contains('open'));

/* ---------- 攻略页 ---------- */
console.log('\n[攻略页]');
const art = await make(BASE + 'a/ejl-start/', { gl_pos_v1: '{"ejl-start":60}' });
await wait(600);
const ad = art.window.document;
const aw = art.window;

ok('正文已预渲染', ad.querySelectorAll('.prose p').length >= 3, String(ad.querySelectorAll('.prose p').length));
ok('内联目录条数匹配标题', ad.querySelectorAll('.toc li').length === ad.querySelectorAll('.prose h2').length,
  ad.querySelectorAll('.toc li').length + '/' + ad.querySelectorAll('.prose h2').length);
const firstTocHref = ad.querySelector('.toc a')?.getAttribute('href') || '';
ok('目录锚点指向正文标题', !!ad.querySelector(firstTocHref), firstTocHref);
ok('浮层目录已生成', ad.querySelectorAll('.toc-float a').length === ad.querySelectorAll('.toc li').length,
  ad.querySelectorAll('.toc-float a').length + '/' + ad.querySelectorAll('.toc li').length);
ok('浮层目录高亮当前节', !!ad.querySelector('.toc-float a.on'));

/* 视觉特效层 */
const h2s = [...ad.querySelectorAll('.prose h2[id]')];
const hAnchors = [...ad.querySelectorAll('.prose h2 .h-anchor')];
ok('启用了逐块入场（关闭整块动画）', !!ad.querySelector('.article.fx-parent'));
ok('每个小节标题都有锚点', h2s.length > 0 && hAnchors.length === h2s.length, hAnchors.length + '/' + h2s.length);
ok('锚点 href 对齐小节 id', hAnchors.every(a => a.getAttribute('href') === '#' + a.parentElement.id));
hAnchors[0].click();
await wait(60);
ok('点锚点后地址栏带上本节 id', ad.location.hash === '#' + h2s[0].id, ad.location.hash);
ok('内联目录同步高亮', !!ad.querySelector('.toc a.on'));
ok('手机目录按钮已注入', !!ad.querySelector('.toc-m-btn'));
const sheet = ad.querySelector('.toc-sheet');
const mask = ad.querySelector('.toc-mask');
ok('目录抽屉条数匹配', sheet && sheet.querySelectorAll('a').length === ad.querySelectorAll('.toc li').length,
  sheet ? sheet.querySelectorAll('a').length + '/' + ad.querySelectorAll('.toc li').length : '无抽屉');
ad.querySelector('.toc-m-btn').click();
ok('点击呼出抽屉', sheet.classList.contains('open') && mask.classList.contains('open'));
mask.click();
ok('点遮罩收起抽屉', !sheet.classList.contains('open') && !mask.classList.contains('open'));
ad.querySelector('.toc-m-btn').click();
sheet.querySelector('a').click();
ok('点目录项跳转并收起', !sheet.classList.contains('open'));
ok('字号控件存在', ad.querySelectorAll('.fs-ctrl button').length === 3);
ad.querySelector('.fs-ctrl [data-fs="l"]').click();
ok('切换字号写入属性', ad.querySelector('.article').getAttribute('data-fs') === 'l');
ok('字号选择被记住', aw.localStorage.getItem('gl_fs_v1') === '"l"');
ok('「继续阅读」提示出现', !!ad.querySelector('.resume'), (ad.querySelector('.resume')?.textContent || '').trim());
ok('提示里带上次进度', /60%/.test(ad.querySelector('.resume')?.textContent || ''));
ok('访问后记为已读', JSON.parse(aw.localStorage.getItem('gl_read_v1') || '[]').includes('ejl-start'));
ok('回到顶部按钮存在', !!ad.querySelector('.to-top'));
ok('回顶带环形进度', !!ad.querySelector('.to-top .tt-bar') && /dashoffset/.test(ad.querySelector('.to-top .tt-bar').getAttribute('style') || ''));

/* 文章页收藏 */
const bookBtn = ad.querySelector('[data-book]');
ok('文章页收藏按钮存在', !!bookBtn);
ok('初始为未收藏', bookBtn.getAttribute('aria-pressed') === 'false', bookBtn.getAttribute('aria-pressed'));
bookBtn.click();
await wait(60);
ok('点击后收藏态', bookBtn.getAttribute('aria-pressed') === 'true' && /已收藏/.test(bookBtn.textContent));
ok('收藏写入本地', JSON.parse(aw.localStorage.getItem('gl_book_v1') || '[]').includes('ejl-start'));
bookBtn.click();
await wait(60);
ok('再点取消收藏', bookBtn.getAttribute('aria-pressed') === 'false' && !JSON.parse(aw.localStorage.getItem('gl_book_v1') || '[]').includes('ejl-start'));

/* 文章页搜索面板：/ 呼出（文章页没有内联搜索框） */
ad.dispatchEvent(new aw.KeyboardEvent('keydown', { key: '/', bubbles: true }));
await wait(80);
ok('文章页 / 呼出搜索', ad.querySelector('.pal').classList.contains('open'));
ad.querySelector('.pal').dispatchEvent(new aw.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

/* 分享 */
ok('文章页有分享区块', !!ad.querySelector('.share'));
ok('分享含复制链接', !!ad.querySelector('[data-share-copy]'));
const qrBtn = ad.querySelector('[data-share-qr]');
const qrPanel = ad.querySelector('#shareQr');
ok('二维码默认收起', !!qrPanel && qrPanel.hidden && qrBtn.getAttribute('aria-expanded') === 'false');
qrBtn.click();
await wait(60);
ok('点「微信扫码」展开二维码', !qrPanel.hidden && qrBtn.getAttribute('aria-expanded') === 'true');
ok('二维码图片指向本页 qr.svg', /qr\.svg$/.test(qrPanel.querySelector('img')?.getAttribute('src') || ''));
qrBtn.click();
ok('再点收起二维码', qrPanel.hidden);
const weibo = ad.querySelector('.share a[href*="weibo"]');
const qq = ad.querySelector('.share a[href*="shareqq"]');
ok('微博链接带本页 URL', (weibo?.getAttribute('href') || '').includes('a%2Fejl-start%2F'));
ok('QQ 链接带本页 URL', (qq?.getAttribute('href') || '').includes('a%2Fejl-start%2F'));
ok('外链均带 noopener', [weibo, qq].every(a => /noopener/.test(a?.getAttribute('rel') || '')));
/* 分享链接必须与 canonical 同域，换域名时漏改会在这里暴露 */
const canon = ad.querySelector('link[rel="canonical"]')?.href || '';
const wUrl = new URL(weibo.getAttribute('href')).searchParams.get('url') || '';
ok('分享链接与 canonical 同域', !!canon && new URL(wUrl).origin === new URL(canon).origin, new URL(wUrl).origin + ' vs ' + new URL(canon).origin);

/* 二维码文件完整性（生成在构建期，缺了会让分享区少一项） */
const fsMod = await import('node:fs');
const qrDirs = fsMod.readdirSync('a').filter(d => fsMod.existsSync(`a/${d}/qr.svg`));
ok('23 篇文章都有分享二维码', qrDirs.length === 23, String(qrDirs.length));
ok('站点二维码存在', fsMod.existsSync('assets/qr-site.svg'));

/* 手机端分享形态：二维码收起、无 Web Share 时给微信转发提示 */
const mob = await make(BASE + 'a/ejl-start/', {}, { width: 375 });
await wait(700);
const md = mob.window.document;
const mQrBtn = md.querySelector('.share [data-share-qr]');
ok('手机端收起「微信扫码」', !!mQrBtn && mQrBtn.hidden === true);
ok('手机端二维码面板保持收起', !!md.getElementById('shareQr') && md.getElementById('shareQr').hidden);
ok('无系统分享时给微信转发提示', !!md.querySelector('.share-row .share-tip') && /发送给朋友/.test(md.querySelector('.share-row .share-tip').textContent));
ok('手机端保留复制链接', !!md.querySelector('.share [data-share-copy]'));
mob.window.close();

/* 旧域名过渡：脚本逻辑用 vm 直跑，验证路径映射且不误伤正式域名 */
const vmMod = await import('node:vm');
const fsMod2 = await import('node:fs');
const mSnip = fsMod2.readFileSync('index.html', 'utf8').match(/<script>\/\* 旧域名过渡[\s\S]*?<\/script>/);
ok('首页含旧域名过渡脚本', !!mSnip);
const snip = (mSnip ? mSnip[0] : '').replace(/^<script>/, '').replace(/<\/script>$/, '');
function runSnip(hostname, pathname, search, hash) {
  let out = null;
  vmMod.runInNewContext(snip, { location: { hostname, pathname, search, hash, replace: u => { out = u; } } });
  return out;
}
const r1 = runSnip('sdadsa424.github.io', '/gonglue-tai/a/ejl-start/', '', '');
const r2 = runSnip('sdadsa424.github.io', '/gonglue-tai/', '', '');
const r3 = runSnip('sdadsa424.github.io', '/gonglue-tai/', '?q=x', '#/a/ejl-start');
const r4 = runSnip('wgame-bc7.pages.dev', '/a/ejl-start/', '', '');
const r5 = runSnip('127.0.0.1', '/a/ejl-start/', '', '');
ok('旧域名文章页映射到同一路径', r1 === 'https://wgame-bc7.pages.dev/a/ejl-start/', r1);
ok('旧域名根映射到新根', r2 === 'https://wgame-bc7.pages.dev/', r2);
ok('跳转保留查询串与 hash', r3 === 'https://wgame-bc7.pages.dev/?q=x#/a/ejl-start', r3);
ok('正式域名不触发跳转', r4 === null, String(r4));
ok('本地预览不触发跳转', r5 === null, String(r5));
const snipPages = fsMod2.readdirSync('a').filter(d => fsMod2.readFileSync(`a/${d}/index.html`, 'utf8').includes('旧域名过渡'));
ok('23 篇攻略页都带过渡脚本', snipPages.length === 23, String(snipPages.length));

/* 首屏落点：刷新/新进入回顶部，前进后退与锚点不干预（逻辑用 vm 直跑） */
const mTop = fsMod2.readFileSync('a/ejl-start/index.html', 'utf8').match(/<script>\/\* ---------- 首屏落点[\s\S]*?<\/script>/);
ok('攻略页含首屏落点脚本', !!mTop);
const topSnip = (mTop ? mTop[0] : '').replace(/^<script>/, '').replace(/<\/script>$/, '');
function runTop(o) {
  o = o || {};
  let scrolled = null, raf = 0;
  const w = {
    scrollY: o.scrollY === undefined ? 900 : o.scrollY,
    scrollTo: (x, y) => { if (x === 0 && y === 0) scrolled = 0; },
    addEventListener: () => {}
  };
  vmMod.runInNewContext(topSnip, {
    window: w,
    location: { hash: o.hash || '' },
    performance: { getEntriesByType: () => [{ type: o.type || 'navigate' }] },
    document: { getElementById: id => ((o.ids || []).indexOf(id) >= 0 ? {} : null) },
    requestAnimationFrame: () => { raf++; }
  });
  return { scrolled, raf };
}
const tNav = runTop({ type: 'navigate' });
const tReload = runTop({ type: 'reload' });
const tBack = runTop({ type: 'back_forward' });
const tAnchor = runTop({ hash: '#sec-2', ids: ['sec-2'] });
const tAlreadyTop = runTop({ scrollY: 0 });
ok('新进入从顶部开始', tNav.scrolled === 0);
ok('刷新也从顶部开始', tReload.scrolled === 0);
ok('前进后退不抢浏览器的恢复位置', tBack.scrolled === null, String(tBack.scrolled));
ok('带小节锚点时尊重锚点', tAnchor.scrolled === null, String(tAnchor.scrolled));
ok('已在顶部时不重复滚动', tAlreadyTop.scrolled === null, String(tAlreadyTop.scrolled));
const homeHTML = fsMod2.readFileSync('index.html', 'utf8');
ok('首页也接管滚动恢复', /history\.scrollRestoration='manual'/.test(homeHTML) && /navType === 'back_forward'/.test(homeHTML));

/* 头部落点脚本：刷新时清掉残留的板块锚点（攻略页点「开荒路线」会留下 #route） */
const mHead = homeHTML.match(/<script>\/\* 落点控制[\s\S]*?<\/script>/);
ok('首页含落点控制脚本', !!mHead);
const headSnip = (mHead ? mHead[0] : '').replace(/^<script>/, '').replace(/<\/script>$/, '');
function runHead(o) {
  let replaced = null, manual = null;
  vmMod.runInNewContext(headSnip, {
    performance: { getEntriesByType: () => [{ type: o.type }] },
    location: { hash: o.hash || '' },
    history: {
      get scrollRestoration() { return manual; },
      set scrollRestoration(v) { manual = v; },
      replaceState: (a, b, url) => { replaced = url; }
    }
  });
  return { replaced, manual };
}
const hReloadRoute = runHead({ type: 'reload', hash: '#route' });
const hNavRoute = runHead({ type: 'navigate', hash: '#route' });
const hReloadSlash = runHead({ type: 'reload', hash: '#/' });
const hNavPlain = runHead({ type: 'navigate', hash: '' });
const hBack = runHead({ type: 'back_forward', hash: '#route' });
ok('刷新时清掉残留的 #route', hReloadRoute.replaced === '#/', String(hReloadRoute.replaced));
ok('点导航跳过来那次不清（按锚点落位）', hNavRoute.replaced === null, String(hNavRoute.replaced));
ok('已有 #/ 时不动地址栏', hReloadSlash.replaced === null, String(hReloadSlash.replaced));
ok('新进入关闭浏览器滚动恢复', hNavPlain.manual === 'manual', String(hNavPlain.manual));
ok('前进后退不碰滚动恢复与地址栏', hBack.manual === null && hBack.replaced === null,
  hBack.manual + '/' + hBack.replaced);

/* 首页落点：板块锚点落位后把地址栏收回 #/，否则 #route 会一直粘在网址上 */
const mHomeTop = homeHTML.match(/\(function landTop\(\)[\s\S]*?\n\}\)\(\);/);
ok('首页含落点函数', !!mHomeTop);
const homeTopSnip = mHomeTop ? mHomeTop[0] : '';
function runHomeTop(o) {
  o = o || {};
  let scrolled = null, replaced = null;
  const w = {
    scrollY: o.scrollY === undefined ? 900 : o.scrollY,
    scrollTo: (x, y) => { if (x === 0 && y === 0) scrolled = 0; },
    addEventListener: () => {},
    requestAnimationFrame: () => {}
  };
  vmMod.runInNewContext(homeTopSnip, {
    window: w,
    location: { hash: o.hash || '' },
    history: { replaceState: (a, b, url) => { replaced = url; } },
    performance: { getEntriesByType: () => [{ type: o.type || 'navigate' }] },
    document: { getElementById: id => ((o.ids || []).indexOf(id) >= 0 ? {} : null) },
    requestAnimationFrame: () => {}
  });
  return { scrolled, replaced };
}
const hRouteAnchor = runHomeTop({ hash: '#route', ids: ['route'] });
const hPlain = runHomeTop({ hash: '' });
const hSlash = runHomeTop({ hash: '#/' });
ok('#route 落位后收回成 #/', hRouteAnchor.replaced === '#/' && hRouteAnchor.scrolled === null,
  hRouteAnchor.replaced + '/' + hRouteAnchor.scrolled);
ok('没有锚点时回顶部', hPlain.scrolled === 0, String(hPlain.scrolled));
ok('#/ 同样回顶部', hSlash.scrolled === 0, String(hSlash.scrolled));


const restorePages = fsMod2.readdirSync('a').filter(d => /scrollRestoration/.test(fsMod2.readFileSync(`a/${d}/index.html`, 'utf8')));
ok('23 篇攻略页都接管滚动恢复', restorePages.length === 23, String(restorePages.length));

/* 模板字符串里反斜杠被吃掉过一次，这里锁死「24 个页面脚本逐字一致且可解析」 */
const pickSnip = f => (fsMod2.readFileSync(f, 'utf8').match(/<script>\/\* 旧域名过渡[\s\S]*?<\/script>/) || [''])[0];
const homeSnip = pickSnip('index.html');
const sameSnip = fsMod2.readdirSync('a').every(d => pickSnip(`a/${d}/index.html`) === homeSnip);
let snipParses = true;
try { new vmMod.Script(homeSnip.replace(/^<script>/, '').replace(/<\/script>$/, '')); } catch (e) { snipParses = false; }
ok('24 个页面过渡脚本逐字一致', !!homeSnip && sameSnip);
ok('过渡脚本文法有效', snipParses);

/* 正文插图：首页内联视图与静态页两条渲染链都要出图 */
const fsm = await import('node:fs');
const siegeHTML = fsm.readFileSync('a/xxtl-siege/index.html', 'utf8');
ok('静态页插图路径上溯两级', /src="\.\.\/\.\.\/assets\/xxtl-siege\.jpg"/.test(siegeHTML));
ok('静态页插图有 webp 源', /srcset="\.\.\/\.\.\/assets\/xxtl-siege\.webp"/.test(siegeHTML));
ok('静态页插图带图注', /<figcaption>[^<]+<\/figcaption>/.test(siegeHTML));
const figureCount = (siegeHTML.match(/class="fig"/g) || []).length;
ok('静态页共 1 张插图', figureCount === 1, String(figureCount));
ok('静态页插图懒加载 + 带宽高', /<img src="\.\.\/\.\.\/assets\/xxtl-siege\.jpg"[^>]*width="1080" height="608" loading="lazy"/.test(siegeHTML));

/* 精确指针设备才挂光标高光 */
const desk = await make(BASE, {}, { pointerFine: true });
await wait(700);
const dd = desk.window.document;
const firstEntry = dd.querySelector('#entryList .entry');
firstEntry.dispatchEvent(new desk.window.MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 40 }));
await wait(60);
ok('桌面端卡片按需挂上光标高光', firstEntry.classList.contains('glow-host'));
const posterEl = dd.querySelector('.poster');
posterEl.dispatchEvent(new desk.window.MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 120 }));
await wait(80);
ok('桌面端卡片进入 3D 倾斜态', posterEl.classList.contains('tilt-on'));
/* 3D 相关样式：倾斜变换、触屏入场、与 hover 变换的兼容 */
const css3d = (await import('node:fs')).readFileSync('assets/style.css', 'utf8');
ok('倾斜用 perspective + rotateX/rotateY', /\.poster,\.entry,\.game-card,\.related a\{[^}]*perspective\(900px\) rotateX\(var\(--rx[^}]*rotateY\(var\(--ry/.test(css3d));
ok('hover 时保留倾斜不被位移覆盖', /\.poster:hover,\.entry:hover,\.game-card:hover,\.related a:hover\{[^}]*rotateX\(var\(--rx/.test(css3d));
ok('触屏有 3D 入场关键帧', /@keyframes c3dIn\{from\{opacity:0;transform:translateY\(16px\) rotateX\(10deg\)\}/.test(css3d));
ok('触屏入场尊重减少动态', /@media \(hover:none\) and \(prefers-reduced-motion:no-preference\)/.test(css3d));
desk.window.close();

/* 小节标题 3D 翻转入场 */
console.log('\n[小节标题 3D 翻转]');
ok('标题绕底边后仰 26° 进入', /\.prose h2\.fx\{[^}]*transform-origin:50% 100%[^}]*perspective\(760px\) rotateX\(26deg\)/.test(css3d));
ok('翻正后回到平铺', /\.prose h2\.fx\.fx-in\{transform:none\}/.test(css3d));
ok('翻转规则压在通用入场之后（覆盖 translateY）', css3d.indexOf('.prose h2.fx{') > css3d.indexOf('.fx{opacity:0;transform:translateY(12px)'));
const flipPage = await make(BASE + 'a/xxtl-siege/', {}, { fxProbe: true });
await wait(500);
const fpd = flipPage.window.document;
const fh2 = fpd.querySelector('.prose h2');
ok('小节标题拿到待入场类', !!fh2 && fh2.classList.contains('fx'));
ok('滚入视口后翻正', !!fh2 && fh2.classList.contains('fx-in'));
ok('标题之外的正文档照常入场', !!fpd.querySelector('.prose p.fx-in'));
flipPage.window.close();

/* 顶栏：当地时间 + 天气 */
console.log('\n[顶栏时间与天气]');
const GEO = { success: true, latitude: 31.86, longitude: 117.28, city: '合肥' };
const WXOK = { current: { temperature_2m: 26.4, weather_code: 0, is_day: 1 } };
function wxStub(geo, wx) {
  return url => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(url.indexOf('open-meteo') >= 0 ? wx : geo)
  });
}
const wtPage = await make(BASE, {}, { fetchStub: wxStub(GEO, WXOK) });
await wait(400);
const wtd = wtPage.window.document;
const wtBox = wtd.getElementById('wt');
ok('顶栏有时间天气块', !!wtBox);
ok('时间按两位补零', /^\d{2}$/.test(wtd.querySelector('[data-wt-h]').textContent) &&
  /^\d{2}$/.test(wtd.querySelector('[data-wt-m]').textContent),
  wtd.querySelector('[data-wt-h]').textContent + ':' + wtd.querySelector('[data-wt-m]').textContent);
ok('时钟不早于页面加载时刻', Math.abs(Number(wtd.querySelector('[data-wt-h]').textContent) - new Date().getHours()) <= 1);
const wtWx = wtd.querySelector('[data-wt-wx]');
ok('拿到天气后展开', !!wtWx && !wtWx.hasAttribute('hidden'));
ok('温度四舍五入到整数度', wtd.querySelector('[data-wt-temp]').textContent === '26°', wtd.querySelector('[data-wt-temp]').textContent);
ok('晴天出太阳图标', !!wtd.querySelector('.wt-ico .wi-sun'));
ok('悬停文案带城市与天气', /合肥/.test(wtWx.getAttribute('title') || '') && /晴/.test(wtWx.getAttribute('title') || ''), wtWx.getAttribute('title'));
ok('请求先定位再查天气', wtPage.window.__fetchCalls.length === 2 &&
  /ipwho\.is/.test(wtPage.window.__fetchCalls[0]) && /open-meteo/.test(wtPage.window.__fetchCalls[1]),
  wtPage.window.__fetchCalls.join(' | '));
wtPage.window.close();

const nightPage = await make(BASE, {}, {
  fetchStub: wxStub(GEO, { current: { temperature_2m: 3.2, weather_code: 0, is_day: 0 } })
});
await wait(400);
ok('夜间晴天出月亮图标', !!nightPage.window.document.querySelector('.wt-ico .wi-moon'));
nightPage.window.close();

const rainPage = await make(BASE, {}, {
  fetchStub: wxStub(GEO, { current: { temperature_2m: 18, weather_code: 63, is_day: 1 } })
});
await wait(400);
ok('中雨出雨滴图标', !!rainPage.window.document.querySelector('.wt-ico .wi-rain'));
rainPage.window.close();

const cachedPage = await make(BASE, {
  gl_wx_v1: JSON.stringify({ t: Date.now(), temp: 12.6, code: 71, day: 1, city: '合肥' })
}, { fetchStub: wxStub(GEO, WXOK) });
await wait(250);
const cpd = cachedPage.window.document;
ok('缓存命中直接出天气', cpd.querySelector('[data-wt-temp]').textContent === '13°');
ok('缓存命中不重复请求', cachedPage.window.__fetchCalls.length === 0, String(cachedPage.window.__fetchCalls.length));
ok('小雪出雪花图标', !!cpd.querySelector('.wt-ico .wi-snow'));
cachedPage.window.close();

const failPage = await make(BASE, {}, { fetchStub: () => Promise.reject(new Error('offline')) });
await wait(400);
const fpd2 = failPage.window.document;
ok('取数失败只留时钟', !!fpd2.querySelector('[data-wt-wx]').hasAttribute('hidden') &&
  /^\d{2}$/.test(fpd2.querySelector('[data-wt-h]').textContent));
failPage.window.close();

const artWt = fsm.readFileSync('a/xxtl-siege/index.html', 'utf8');
ok('攻略页也带时间天气块', /data-wt-m/.test(artWt) && /class="wt"/.test(artWt));
const cssWt = fsMod2.readFileSync('assets/style.css', 'utf8');
ok('天气动效在减弱动效时关闭', /@media \(prefers-reduced-motion:no-preference\)\{[\s\S]*\.wi-rain \.d\{animation/.test(cssWt));

/* 定位：面板、手动选城市、精确定位 */
console.log('\n[定位]');
const locPage = await make(BASE, {}, { fetchStub: wxStub(GEO, WXOK) });
await wait(400);
const ld = locPage.window.document, lw = locPage.window;
const wtPop = ld.getElementById('wt-pop');
ok('定位面板默认收起', !!wtPop && wtPop.hasAttribute('hidden'));
ok('胶囊可点且折叠态正确', ld.getElementById('wt').getAttribute('role') === 'button' &&
  ld.getElementById('wt').getAttribute('aria-expanded') === 'false');
ld.getElementById('wt').click();
await wait(60);
ok('点胶囊展开面板', !wtPop.hasAttribute('hidden') &&
  ld.getElementById('wt').getAttribute('aria-expanded') === 'true');
ok('面板显示当前城市与来源', ld.querySelector('[data-wt-cur]').textContent === '合肥' &&
  /IP/.test(ld.querySelector('[data-wt-src]').textContent),
  ld.querySelector('[data-wt-cur]').textContent + ' / ' + ld.querySelector('[data-wt-src]').textContent);
ok('顶栏胶囊也显示城市名', ld.querySelector('[data-wt-city]').textContent === '合肥');
ok('快捷城市按钮齐全', ld.querySelectorAll('[data-wt-chips] button').length === 10,
  String(ld.querySelectorAll('[data-wt-chips] button').length));

lw.__fetchCalls.length = 0;
ld.querySelector('[data-lat="30.2741"]').click();
await wait(400);
const locRec = JSON.parse(lw.localStorage.getItem('gl_loc_v1') || 'null');
ok('选城市写入本地定位', !!locRec && locRec.city === '杭州' && locRec.src === 'manual', JSON.stringify(locRec));
ok('改用该城市坐标查天气，不再走 IP', lw.__fetchCalls.length === 1 &&
  /latitude=30\.274/.test(lw.__fetchCalls[0]), lw.__fetchCalls.join(' | '));
ok('来源标注为手动选择', /手动/.test(ld.querySelector('[data-wt-src]').textContent),
  ld.querySelector('[data-wt-src]').textContent);

lw.document.dispatchEvent(new lw.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(60);
ok('Esc 收起面板', wtPop.hasAttribute('hidden') &&
  ld.getElementById('wt').getAttribute('aria-expanded') === 'false');
locPage.window.close();

const fixedPage = await make(BASE, {
  gl_loc_v1: JSON.stringify({ lat: 30.2741, lon: 120.1551, city: '杭州', src: 'manual' })
}, { fetchStub: wxStub(GEO, WXOK) });
await wait(400);
ok('已固定城市时首屏直接用该坐标', fixedPage.window.__fetchCalls.length === 1 &&
  /latitude=30\.274/.test(fixedPage.window.__fetchCalls[0]), fixedPage.window.__fetchCalls.join(' | '));
ok('已固定城市时跳过 IP 定位', !/ipwho|ipapi/.test(fixedPage.window.__fetchCalls.join(' ')));
fixedPage.window.close();

const stalePage = await make(BASE, {
  gl_loc_v1: JSON.stringify({ lat: 30.2741, lon: 120.1551, city: '杭州', src: 'manual' }),
  gl_wx_v1: JSON.stringify({ t: Date.now(), temp: 25, code: 0, day: 1, city: '北京', lat: 39.9, lon: 116.4, src: 'manual' })
}, { fetchStub: wxStub(GEO, WXOK) });
await wait(400);
ok('旧城市的缓存不顶替新位置', stalePage.window.__fetchCalls.length === 1 &&
  /latitude=30\.274/.test(stalePage.window.__fetchCalls[0]), stalePage.window.__fetchCalls.join(' | '));
stalePage.window.close();

const gpsPage = await make(BASE, {}, { fetchStub: wxStub(GEO, WXOK), geo: { lat: 29.86, lon: 121.55 } });
await wait(400);
const gd = gpsPage.window.document;
gd.getElementById('wt').click();
await wait(50);
gpsPage.window.__fetchCalls.length = 0;
gd.querySelector('[data-wt-gps]').click();
await wait(450);
const gpsRec = JSON.parse(gpsPage.window.localStorage.getItem('gl_loc_v1') || 'null');
ok('精确定位写入本地', !!gpsRec && gpsRec.src === 'gps' && Math.abs(gpsRec.lat - 29.86) < 0.01, JSON.stringify(gpsRec));
ok('精确定位后按新坐标取天气', /latitude=29\.860/.test(gpsPage.window.__fetchCalls.join(' ')),
  gpsPage.window.__fetchCalls.join(' | '));
ok('顶栏改显示我的位置', gd.querySelector('[data-wt-city]').textContent === '我的位置',
  gd.querySelector('[data-wt-city]').textContent);
gpsPage.window.close();

const denyPage = await make(BASE, {}, { fetchStub: wxStub(GEO, WXOK), geo: { error: 1 } });
await wait(400);
const denyDoc = denyPage.window.document;
denyDoc.getElementById('wt').click();
await wait(50);
denyDoc.querySelector('[data-wt-gps]').click();
await wait(200);
const denyTip = denyDoc.querySelector('[data-wt-tip]');
ok('定位被拒给出兜底提示', !denyTip.hasAttribute('hidden') && /权限/.test(denyTip.textContent), denyTip.textContent);
ok('定位被拒不写入本地', denyPage.window.localStorage.getItem('gl_loc_v1') === null);
denyPage.window.close();

const autoPage = await make(BASE, {
  gl_loc_v1: JSON.stringify({ lat: 30.2741, lon: 120.1551, city: '杭州', src: 'manual' })
}, { fetchStub: wxStub(GEO, WXOK) });
await wait(400);
const autoDoc = autoPage.window.document;
autoDoc.getElementById('wt').click();
await wait(50);
autoPage.window.__fetchCalls.length = 0;
autoDoc.querySelector('[data-wt-auto]').click();
await wait(400);
ok('按 IP 自动清除固定位置', autoPage.window.localStorage.getItem('gl_loc_v1') === null);
ok('清除后重新走 IP 定位', /ipwho\.is/.test(autoPage.window.__fetchCalls.join(' ')),
  autoPage.window.__fetchCalls.join(' | '));
autoPage.window.close();

function wxStubMulti() {
  return url => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(
      /geocoding-api/.test(url)
        ? { results: [{ name: '杭州', admin1: '浙江', country: '中国', latitude: 30.29, longitude: 120.16 }] }
        : /open-meteo/.test(url) ? WXOK : GEO)
  });
}
const searchPage = await make(BASE, {}, { fetchStub: wxStubMulti() });
await wait(400);
const sd = searchPage.window.document;
sd.getElementById('wt').click();
await wait(50);
const qBox = sd.querySelector('[data-wt-q]');
qBox.value = '杭州';
qBox.dispatchEvent(new searchPage.window.Event('input', { bubbles: true }));
await wait(700);
const hit = sd.querySelector('[data-wt-res] button[data-i]');
ok('城市搜索出结果', !!hit && /杭州/.test(hit.textContent), hit ? hit.textContent : '无结果');
if (hit) hit.click();
await wait(400);
const schRec = JSON.parse(searchPage.window.localStorage.getItem('gl_loc_v1') || 'null');
ok('点搜索结果切换城市', !!schRec && schRec.city === '杭州' && schRec.src === 'manual', JSON.stringify(schRec));
searchPage.window.close();

ok('面板收起样式不被 display:flex 顶掉', /\.wt-pop\[hidden\]\{display:none\}/.test(cssWt));
ok('窄屏隐藏顶栏城市名', /@media \(max-width:760px\)\{[\s\S]*?\.wt-city\{display:none\}/.test(cssWt));



console.log('\n运行期报错：' + (errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : '无'));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
