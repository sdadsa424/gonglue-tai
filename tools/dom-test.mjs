/* 需要 jsdom：npm i jsdom（或设 JSDOM_PATH 指向已安装的 jsdom 入口）
   用法：先起本地服务 node/python http.server，再 node tools/dom-test.mjs */
const { JSDOM, VirtualConsole } = await import(process.env.JSDOM_PATH || 'jsdom');

const BASE = process.env.BASE || 'http://127.0.0.1:8766/';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

function make(url) {
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
const home = await make(BASE);
await wait(700);
const hd = home.window.document;
const w = home.window;

ok('列表渲染 23 篇', hd.querySelectorAll('#entryList .entry').length === 23, String(hd.querySelectorAll('#entryList .entry').length));
ok('卡片指向真 URL', (hd.querySelector('#entryList .entry')?.getAttribute('href') || '').startsWith('a/'));
ok('注入了回到顶部按钮', !!hd.querySelector('.to-top'));

// 搜索命中高亮
const input = hd.getElementById('searchInput');
input.value = '转生';
input.dispatchEvent(new w.Event('input', { bubbles: true }));
await wait(80);
const marks = hd.querySelectorAll('#entryList mark.hl');
ok('搜索关键词高亮', marks.length > 0, 'marks=' + marks.length);
ok('搜索过滤生效', hd.querySelectorAll('#entryList .entry').length < 23, String(hd.querySelectorAll('#entryList .entry').length));

// 回车保存历史
input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(60);
const hist = JSON.parse(w.localStorage.getItem('gl_q_v1') || '[]');
ok('搜索历史写入', hist[0] === '转生', JSON.stringify(hist));
ok('历史胶囊渲染', hd.querySelectorAll('#qHist .q-chip').length === 1, String(hd.querySelectorAll('#qHist .q-chip').length));

// 已读标记
w.localStorage.setItem('gl_read_v1', JSON.stringify(['ejl-start']));
hd.getElementById('clearFilter').click();
await wait(80);
const readEntry = [...hd.querySelectorAll('#entryList .entry')].find(a => a.getAttribute('href') === 'a/ejl-start/');
ok('已读条目带 is-read', !!readEntry && readEntry.classList.contains('is-read'));
ok('已读徽标可见', !!readEntry?.querySelector('.entry-read'));

/* ---------- 攻略页 ---------- */
console.log('\n[攻略页]');
const art = await make(BASE + 'a/ejl-start/');
await wait(500);
const ad = art.window.document;
const aw = art.window;

ok('正文已预渲染', ad.querySelectorAll('.prose p').length >= 3, String(ad.querySelectorAll('.prose p').length));
ok('目录存在且条目数匹配', ad.querySelectorAll('.toc li').length === ad.querySelectorAll('.prose h2').length,
  ad.querySelectorAll('.toc li').length + '/' + ad.querySelectorAll('.prose h2').length);
const firstTocHref = ad.querySelector('.toc a')?.getAttribute('href') || '';
ok('目录锚点指向正文标题', !!ad.querySelector(firstTocHref), firstTocHref);
ok('字号控件存在', ad.querySelectorAll('.fs-ctrl button').length === 3);
ad.querySelector('.fs-ctrl [data-fs="l"]').click();
ok('切换字号写入属性', ad.querySelector('.article').getAttribute('data-fs') === 'l');
ok('字号选择被记住', aw.localStorage.getItem('gl_fs_v1') === '"l"', aw.localStorage.getItem('gl_fs_v1'));
ok('访问后记为已读', JSON.parse(aw.localStorage.getItem('gl_read_v1') || '[]').includes('ejl-start'));
ok('回到顶部按钮存在', !!ad.querySelector('.to-top'));

console.log('\n运行期报错：' + (errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : '无'));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
