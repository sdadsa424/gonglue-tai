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

function make(url, seed) {
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

console.log('\n运行期报错：' + (errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : '无'));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
