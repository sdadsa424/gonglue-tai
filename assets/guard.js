/* 站点内容防护层
 *
 * 先说明一句实话：浏览器必须拿到 HTML / CSS / JS 才能显示页面，
 * 所以前端不存在「真正加密」——任何人打开开发者工具都能看到源码。
 * 这一层做的是把扒取成本抬高、把来源留在证据链上：
 *   · 反 iframe 套壳（被别的站嵌套时把顶层跳回本站）
 *   · 禁右键菜单 / 禁图片拖拽 / 禁 iOS 长按菜单
 *   · 拦截 F12、Ctrl+Shift+I/J/C、Ctrl+U、Ctrl+S、Ctrl+P 等快捷键
 *   · 复制正文自动附来源尾注（比禁止复制更有效，也不影响阅读）
 *   · DevTools 打开检测（只做标记与控制台提示，不遮挡页面，避免误伤）
 *
 * 维护开关：网址后加 ?dev=1，本标签页内所有拦截关闭（刷新后失效）。
 * 需要长期关闭可在控制台执行 sessionStorage.setItem('gl_guard','off')。
 */
(function () {
  'use strict';

  var SITE = 'wgame-bc7.pages.dev';
  var off = false;
  try {
    if (/[?&]dev=1(?:&|$)/.test(location.search)) sessionStorage.setItem('gl_guard', 'off');
    off = sessionStorage.getItem('gl_guard') === 'off';
  } catch (e) {}
  if (off) return;

  /* ---------- 1. 反 iframe 套壳 ---------- */
  try {
    if (window.top !== window.self) {
      try {
        window.top.location.replace(window.self.location.href);
      } catch (e) {
        /* 跨域套壳拿不到 top.location：直接把自己的内容藏掉，套壳页只剩空白 */
        document.documentElement.style.setProperty('display', 'none', 'important');
      }
    }
  } catch (e) {}

  var root = document.body || document.documentElement;

  /* ---------- 轻提示 ---------- */
  var tipEl = null;
  var tipTimer = 0;
  function tip(msg) {
    try {
      if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.setAttribute('role', 'status');
        tipEl.style.cssText =
          'position:fixed;left:50%;bottom:92px;transform:translateX(-50%) translateY(6px);' +
          'max-width:84vw;padding:9px 14px;border-radius:10px;background:rgba(18,20,32,.95);' +
          'border:1px solid rgba(255,255,255,.14);color:#E7EAF6;' +
          'font:12px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;' +
          'text-align:center;z-index:9999;pointer-events:none;opacity:0;' +
          'transition:opacity .18s ease,transform .18s ease;backdrop-filter:blur(8px)';
        root.appendChild(tipEl);
      }
      tipEl.textContent = msg;
      tipEl.style.opacity = '1';
      tipEl.style.transform = 'translateX(-50%) translateY(0)';
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () {
        tipEl.style.opacity = '0';
        tipEl.style.transform = 'translateX(-50%) translateY(6px)';
      }, 2200);
    } catch (e) {}
  }

  function block(e, why) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    tip(why || '内容受版权保护 · 转载请保留来源 ' + SITE);
  }

  /* ---------- 2. 图片：禁拖拽 + 禁 iOS 长按菜单 ---------- */
  try {
    var st = document.createElement('style');
    st.textContent = 'img{-webkit-touch-callout:none;-webkit-user-drag:none;user-select:none}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  document.addEventListener(
    'dragstart',
    function (e) {
      var t = e.target;
      if (t && (t.tagName === 'IMG' || (t.closest && t.closest('picture')))) {
        e.preventDefault();
        tip('图片受版权保护，禁止拖拽保存');
      }
    },
    false
  );

  /* ---------- 3. 右键菜单 ---------- */
  /* 全站屏蔽默认菜单；按住 Shift 再右键仍可调出原生菜单，
     留给需要「在新标签打开 / 复制链接 / 检查元素」的正常使用者，
     批量扒站的脚本不会去按 Shift。 */
  document.addEventListener(
    'contextmenu',
    function (e) {
      if (e.shiftKey) return;
      e.preventDefault();
      tip('内容受版权保护 · 转载请保留来源 ' + SITE);
    },
    false
  );

  /* ---------- 4. 快捷键 ---------- */
  document.addEventListener(
    'keydown',
    function (e) {
      var k = e.key || '';
      var mod = e.ctrlKey || e.metaKey;
      if (e.keyCode === 123) return block(e, '调试快捷键已禁用');
      if (mod && e.shiftKey && /^[ijc]$/i.test(k)) return block(e, '调试快捷键已禁用');
      if (mod && /^[us]$/i.test(k)) return block(e, '页面源码与另存为受保护');
      if (mod && /^p$/i.test(k)) return block(e, '打印导出已禁用');
      if (mod && e.shiftKey && /^[eu]$/i.test(k)) return block(e, '源码视图已禁用');
    },
    false
  );

  /* ---------- 5. 复制正文附来源 ---------- */
  /* 不禁止选中复制（会伤阅读与无障碍），而是让复制出去的文字自带出处：
     搬运者要么保留来源，要么不得不手工删掉。 */
  document.addEventListener(
    'copy',
    function (e) {
      if (!e.clipboardData) return;
      var sel = '';
      try {
        sel = String(window.getSelection ? window.getSelection() : '');
      } catch (err) {}
      if (sel.length < 80) return; /* 短词、客服号这类不打扰 */
      var t = (document.title || SITE).split(' · ')[0].slice(0, 40);
      var url = location.origin + location.pathname;
      e.clipboardData.setData('text/plain', sel.replace(/\s+$/, '') + '\n\n—— 摘自「游戏攻略大全」《' + t + '》\n' + url);
      e.preventDefault();
    },
    false
  );

  /* ---------- 6. DevTools 检测 ---------- */
  /* 只做属性标记与控制台提示，不锁页面：阈值放得很宽，
     避免浏览器缩放、浏览器自带侧栏被误判成开发者工具而骚扰正常读者。 */
  var dtOpen = 0;
  function warn() {
    try {
      console.log(
        '%c 内容受版权保护 ',
        'background:#2DD4A7;color:#06110D;font-weight:700;padding:2px 6px;border-radius:4px'
      );
      console.log(
        '%c本站为静态站点，整站镜像与批量抓取均需授权。\n需要转载请联系站长，保留原文链接即可获得授权：' + location.origin,
        'color:#8B93A7;font-size:12px'
      );
    } catch (e) {}
  }
  function scan() {
    if (document.hidden) return;
    var w = Math.abs(window.outerWidth - window.innerWidth);
    var h = Math.abs(window.outerHeight - window.innerHeight);
    var on = w > 240 || h > 280;
    if (on === !!dtOpen) return;
    dtOpen = on ? 1 : 0;
    if (on) {
      document.documentElement.setAttribute('data-devtools', '1');
      warn();
    } else {
      document.documentElement.removeAttribute('data-devtools');
    }
  }
  setInterval(scan, 2500);
  scan();
})();
