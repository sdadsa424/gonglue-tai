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
desk.window.close();


console.log('\n运行期报错：' + (errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : '无'));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
