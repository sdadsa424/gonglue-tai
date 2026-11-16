/* 截图防护（尽力而为的威慑层）
   说明：浏览器无法真正阻止系统级截图/录屏（手机截图、外部相机无效）。
   本脚本做三件事，让"随手截图转发"变得困难：
   1) 触发截图动作时（PrintScreen / 截图工具唤起导致失焦 / 切后台），页面瞬间盖上遮罩，
      截到的图是遮罩而不是内容；
   2) 拦截打印、另存、查看源码等常见导出路径；
   3) 禁止右键菜单、图片拖拽、文本选中，降低"另存/复制"的便利性。
   维护开关：url 加 ?shoot=0 可临时关闭本脚本。
   由 build/build.mjs 注入到每个页面（比 ui.js 后加载），不影响首屏渲染。 */
(function () {
  'use strict';
  if (/[?&]shoot=0(&|$)/.test(location.search)) return;
  if (window.__ssGuard) return;
  window.__ssGuard = 1;

  var TITLE = '内容受保护';
  var SUB = '请勿截屏转载 · 本站图文版权所有';

  /* ---------- 遮罩样式 ---------- */
  var css = document.createElement('style');
  css.textContent =
    'body{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}' +
    'input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text}' +
    'img{-webkit-user-drag:none;user-drag:none}' +
    '#ssShield{position:fixed;inset:0;z-index:2147483600;display:none;align-items:center;justify-content:center;' +
    'background:radial-gradient(circle at 50% 42%,#1A1030,#08080F 72%);color:#EDEFFA;text-align:center;' +
    'font:600 15px/1.7 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;letter-spacing:.02em}' +
    '#ssShield.on{display:flex}' +
    '#ssShield b{display:block;font-size:20px;letter-spacing:.06em;margin-bottom:6px;' +
    'background:linear-gradient(92deg,#7CE7C4,#67B3FF 55%,#F58BD8);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '#ssShield span{display:block;color:#9AA1B8;font-weight:500;font-size:13px}' +
    '#ssShield i{display:block;margin:18px auto 0;width:44px;height:44px;border-radius:50%;' +
    'border:2px solid rgba(255,255,255,.14);border-top-color:#67B3FF;animation:ssSpin .9s linear infinite}' +
    '@keyframes ssSpin{to{transform:rotate(360deg)}}' +
    /* 水印层：半透明平铺站名，截图必带，转载可溯源 */
    '.ss-wm{position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:.06;' +
    'background-repeat:repeat;background-position:0 0;mix-blend-mode:screen}' +
    '@media print{.ss-wm{display:none}}';
  (document.head || document.documentElement).appendChild(css);

  /* ---------- 水印平铺层 ---------- */
  (function () {
    var host = location.hostname.replace(/^www\./, '');
    var txt = host + ' · 攻略站';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="170">' +
      '<text x="0" y="100" transform="rotate(-24 0 100)" font-size="15" ' +
      'font-family="system-ui,-apple-system,Segoe UI,Microsoft YaHei,sans-serif" ' +
      'fill="#ffffff">' + txt + '</text></svg>';
    var wm = document.createElement('div');
    wm.className = 'ss-wm';
    wm.setAttribute('aria-hidden', 'true');
    wm.style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    wm.style.backgroundSize = '300px 170px';
    if (document.body) document.body.appendChild(wm);
    else document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(wm);
    });
  })();

  /* ---------- 遮罩节点 ---------- */
  var shield = document.createElement('div');
  shield.id = 'ssShield';
  shield.setAttribute('aria-hidden', 'true');
  shield.innerHTML = '<div><b>' + TITLE + '</b><span>' + SUB + '</span><i></i></div>';
  var shieldTimer = 0;

  function mount() {
    if (!shield.parentNode) (document.body || document.documentElement).appendChild(shield);
  }
  function show(ms) {
    mount();
    shield.classList.add('on');
    if (shieldTimer) clearTimeout(shieldTimer);
    shieldTimer = setTimeout(hide, ms || 1000);
  }
  function hide() {
    if (shieldTimer) { clearTimeout(shieldTimer); shieldTimer = 0; }
    shield.classList.remove('on');
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  /* ---------- 1. 截图动作检测 ---------- */
  /* PrintScreen / 各类截图快捷键按住即遮罩；松开稍后恢复 */
  document.addEventListener('keyup', function (e) {
    if (e.key === 'PrintScreen' || e.keyCode === 44) show(1200);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'PrintScreen' || e.keyCode === 44) show(1200);
  }, true);

  /* 截图工具（Win+Shift+S 等）唤起会让页面失焦；回来时先遮一下，避免"刚截到就恢复" */
  window.addEventListener('blur', function () { show(900); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') show(1200);
    else show(700);
  });

  /* ---------- 2. 拦截导出路径 ---------- */
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    /* Ctrl+P 打印 / Ctrl+S 另存 / Ctrl+U 源码 / Ctrl+Shift+I|J|C 开发者工具 */
    if (k === 'p' || k === 's' || k === 'u' || (e.shiftKey && (k === 'i' || k === 'j' || k === 'c'))) {
      e.preventDefault();
      show(900);
    }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12') { e.preventDefault(); show(900); }
  }, true);

  /* ---------- 3. 右键 / 拖拽 ---------- */
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  }, true);
  document.addEventListener('dragstart', function (e) {
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  }, true);
})();
