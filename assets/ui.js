/* 全站通用交互：回到顶部、正文字号、已读与阅读位置、宽屏浮层目录（首页与静态攻略页共用） */
(function () {
  var KEY_READ = 'gl_read_v1';
  var KEY_FS = 'gl_fs_v1';
  var KEY_POS = 'gl_pos_v1';

  function readLS(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var read = {
    all: function () {
      var a = readLS(KEY_READ, []);
      return Array.isArray(a) ? a : [];
    },
    has: function (id) { return this.all().indexOf(id) > -1; },
    add: function (id) {
      if (!id) return;
      var a = this.all();
      if (a.indexOf(id) > -1) return;
      a.push(id);
      writeLS(KEY_READ, a.slice(-300));
    }
  };

  function posMap() {
    var o = readLS(KEY_POS, {});
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  }
  var pos = {
    get: function (id) {
      var all = posMap();
      var v = Number(all[id]);
      return isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
    },
    set: function (id, pct) {
      var m = posMap();
      m[id] = Math.max(0, Math.min(100, Math.round(pct)));
      writeLS(KEY_POS, m);
    }
  };

  window.GL = { read: read, pos: pos };

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var docEl = document.documentElement;

  /* ---------- 回到顶部 ---------- */
  var top = document.createElement('button');
  top.type = 'button';
  top.className = 'to-top';
  top.setAttribute('aria-label', '回到顶部');
  top.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';
  document.body.appendChild(top);
  function syncTop() { top.classList.toggle('on', window.scrollY > 560); }
  window.addEventListener('scroll', syncTop, { passive: true });
  syncTop();
  top.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- 正文字号 ---------- */
  var article = document.querySelector('.article');
  var ctrl = document.querySelector('.fs-ctrl');
  function applyFs(v) {
    article.setAttribute('data-fs', v);
    var btns = ctrl.querySelectorAll('[data-fs]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', String(btns[i].dataset.fs === v));
    }
  }
  if (article && ctrl) {
    applyFs(readLS(KEY_FS, 'm'));
    ctrl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-fs]');
      if (!btn) return;
      applyFs(btn.dataset.fs);
      writeLS(KEY_FS, btn.dataset.fs);
    });
  }

  /* ---------- 宽屏浮层目录（跟随滚动高亮当前小节） ---------- */
  var toc = document.querySelector('.toc');
  if (toc && article) {
    var ol = toc.querySelector('ol');
    var float = document.createElement('nav');
    float.className = 'toc-float';
    float.setAttribute('aria-label', '文章目录');
    float.innerHTML = '<p class="toc-h">本文目录</p>' + (ol ? ol.outerHTML : '');
    document.body.appendChild(float);

    var links = [].slice.call(float.querySelectorAll('a'));
    var targets = links.map(function (a) {
      return document.getElementById((a.getAttribute('href') || '').replace('#', ''));
    });
    var spyTick = false;
    function spy() {
      spyTick = false;
      var active = -1;
      for (var i = 0; i < targets.length; i++) {
        if (!targets[i]) continue;
        if (targets[i].getBoundingClientRect().top <= 150) active = i;
      }
      for (var j = 0; j < links.length; j++) links[j].classList.toggle('on', j === active);
    }
    window.addEventListener('scroll', function () {
      if (spyTick) return;
      spyTick = true;
      requestAnimationFrame(spy);
    }, { passive: true });
    spy();
  }

  /* ---------- 已读 + 阅读位置 ---------- */
  var gid = document.body.getAttribute('data-guide-id');
  if (!gid) return;

  read.add(gid);

  function maxScroll() {
    return Math.max(0, docEl.scrollHeight - window.innerHeight);
  }
  function savePos() {
    var max = maxScroll();
    if (max < 240) return;
    var pct = Math.round(window.scrollY / max * 100);
    if (pct >= 95) { pos.set(gid, 100); return; }
    if (pct <= 2) return;
    pos.set(gid, pct);
  }

  /* 上次读到中间段：给一个「继续」入口，而不是强行跳走 */
  var saved = pos.get(gid);
  if (saved >= 12 && saved <= 92) {
    var resume = document.createElement('button');
    resume.type = 'button';
    resume.className = 'resume';
    resume.innerHTML = '<span>上次读到 ' + saved + '%</span><b>继续阅读</b>';
    document.body.appendChild(resume);
    resume.addEventListener('click', function () {
      window.scrollTo({ top: maxScroll() * saved / 100, behavior: reduce ? 'auto' : 'smooth' });
      resume.remove();
    });
  }

  var saveTick = false;
  window.addEventListener('scroll', function () {
    if (saveTick) return;
    saveTick = true;
    setTimeout(function () { saveTick = false; savePos(); }, 600);
  }, { passive: true });
  window.addEventListener('pagehide', savePos);
})();
