/* 全站通用交互：收藏、回到顶部、正文字号、已读与阅读位置、目录、全站搜索（首页与静态攻略页共用） */
(function () {
  var KEY_READ = 'gl_read_v1';
  var KEY_FS = 'gl_fs_v1';
  var KEY_POS = 'gl_pos_v1';
  var KEY_BOOK = 'gl_book_v1';

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

  /* 收藏（稍后再看）：只存 id，顺序即收藏先后 */
  var book = {
    all: function () {
      var a = readLS(KEY_BOOK, []);
      return Array.isArray(a) ? a : [];
    },
    has: function (id) { return this.all().indexOf(id) > -1; },
    count: function () { return this.all().length; },
    toggle: function (id) {
      var a = this.all();
      var i = a.indexOf(id);
      if (i > -1) a.splice(i, 1); else a.push(id);
      writeLS(KEY_BOOK, a.slice(-300));
      return i === -1;
    }
  };

  window.GL = { read: read, pos: pos, book: book };

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var docEl = document.documentElement;

  /* ---------- 轻提示 ---------- */
  var toastEl = document.getElementById('uToast');
  var toastTimer = 0;
  function toast(msg) {
    /* 首页已有 showToast，优先复用，避免两套定时器互相抢同一个节点 */
    if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'u-toast';
      toastEl.id = 'uToast';
      toastEl.setAttribute('role', 'status');
      toastEl.innerHTML = '<span class="u-dot" aria-hidden="true"></span><span class="u-text"></span>';
      document.body.appendChild(toastEl);
    }
    var t = toastEl.querySelector('.u-text');
    if (t) t.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------- 回到顶部（圆环显示当前阅读进度） ---------- */
  var top = document.createElement('button');
  top.type = 'button';
  top.className = 'to-top';
  top.setAttribute('aria-label', '回到顶部');
  top.innerHTML = '<svg class="tt-ring" viewBox="0 0 42 42" aria-hidden="true">'
    + '<circle class="tt-track" cx="21" cy="21" r="18"></circle>'
    + '<circle class="tt-bar" cx="21" cy="21" r="18"></circle>'
    + '</svg>'
    + '<svg class="tt-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';
  document.body.appendChild(top);

  var ring = top.querySelector('.tt-bar');
  var RING = 2 * Math.PI * 18;
  ring.style.strokeDasharray = RING + ' ' + RING;
  ring.style.strokeDashoffset = String(RING);

  function syncTop() {
    var max = docEl.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    top.classList.toggle('on', window.scrollY > 560);
    ring.style.strokeDashoffset = String(RING * (1 - p));
  }
  window.addEventListener('scroll', syncTop, { passive: true });
  window.addEventListener('resize', syncTop);
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

  /* ---------- 收藏（点击代理，兼容动态插入的卡片） ---------- */
  var STAR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/></svg>';
  function syncBookBtn(btn) {
    if (btn.dataset.book === undefined) return;
    var on = book.has(btn.dataset.book);
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = STAR + '<span>' + (on ? '已收藏' : '收藏') + '</span>';
  }
  function syncAllBookBtns() {
    var btns = document.querySelectorAll('[data-book]');
    for (var i = 0; i < btns.length; i++) syncBookBtn(btns[i]);
  }
  syncAllBookBtns();
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-book]');
    if (!btn) return;
    e.preventDefault();
    var on = book.toggle(btn.dataset.book);
    syncAllBookBtns();
    toast(on ? '已加入收藏，可在攻略库筛选查看' : '已取消收藏');
    document.dispatchEvent(new CustomEvent('gl:bookchange', { detail: { id: btn.dataset.book, on: on } }));
  });

  /* ---------- 首屏光标光晕（仅精确指针设备） ---------- */
  var hero = document.querySelector('.hero');
  if (hero && !reduce && window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
    var glow = document.createElement('div');
    glow.className = 'hero-glow';
    glow.setAttribute('aria-hidden', 'true');
    hero.insertBefore(glow, hero.firstChild);
    var glowTick = false, gx = 0, gy = 0;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      gx = e.clientX - r.left;
      gy = e.clientY - r.top;
      if (glowTick) return;
      glowTick = true;
      requestAnimationFrame(function () {
        glowTick = false;
        glow.style.setProperty('--mx', gx + 'px');
        glow.style.setProperty('--my', gy + 'px');
      });
    });
    hero.addEventListener('pointerenter', function () { hero.classList.add('has-glow'); });
    hero.addEventListener('pointerleave', function () { hero.classList.remove('has-glow'); });
  }

  /* ---------- 分享 ---------- */
  function canonicalUrl() {
    var l = document.querySelector('link[rel="canonical"]');
    var u = (l && l.href) || window.location.href;
    return u.split('#')[0];
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) {}
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function qrPanelOf(btn) {
    var id = btn.getAttribute('aria-controls');
    var panel = id ? document.getElementById(id) : null;
    if (panel) return panel;
    var box = btn.closest('.share, .foot, .foot-in, .wrap');
    return box ? box.querySelector('.share-qr') : null;
  }
  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-share-copy]');
    if (copyBtn) {
      e.preventDefault();
      copyText(canonicalUrl()).then(function (ok) {
        toast(ok ? '链接已复制，粘贴给朋友就能打开' : '复制被浏览器拦下，请手动复制地址栏');
      });
      return;
    }
    var qrBtn = e.target.closest('[data-share-qr]');
    if (qrBtn) {
      e.preventDefault();
      var panel = qrPanelOf(qrBtn);
      if (!panel) return;
      var show = panel.hidden;
      panel.hidden = !show;
      qrBtn.setAttribute('aria-expanded', String(show));
      if (show && panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    var nativeBtn = e.target.closest('[data-share-native]');
    if (nativeBtn) {
      e.preventDefault();
      if (navigator.share) {
        navigator.share({ title: document.title, url: canonicalUrl() }).catch(function () {});
      }
      return;
    }
  });

  /* ---------- 分享：按设备换形态 ---------- */
  var nbs = document.querySelectorAll('[data-share-native]');
  var coarse = false;
  try {
    coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch (e) {}
  var touch = coarse || window.innerWidth <= 760;

  if (navigator.share) {
    for (var ni = 0; ni < nbs.length; ni++) nbs[ni].hidden = false;
  }

  if (touch) {
    /* 自己扫不了自己的屏：手机上收起二维码，改用系统分享或微信内转发提示 */
    var qbs = document.querySelectorAll('[data-share-qr]');
    for (var qi = 0; qi < qbs.length; qi++) {
      qbs[qi].hidden = true;
      var pid = qbs[qi].getAttribute('aria-controls');
      var pane = pid ? document.getElementById(pid) : null;
      if (pane) pane.hidden = true;
    }
    if (!navigator.share) {
      /* 微信内置浏览器不支持 Web Share，只能给一句能照做的提示 */
      var rows = document.querySelectorAll('.share-row, .foot-share');
      for (var ri = 0; ri < rows.length; ri++) {
        var tip = document.createElement('p');
        tip.className = 'share-tip';
        tip.innerHTML = '微信里转发：点右上角 <b>···</b> → 「发送给朋友」或「分享到朋友圈」';
        rows[ri].appendChild(tip);
      }
    }
  }

  /* ---------- 目录 ---------- */
  var toc = document.querySelector('.toc');
  if (toc && article) {
    var ol = toc.querySelector('ol');
    var float = document.createElement('nav');
    float.className = 'toc-float';
    float.setAttribute('aria-label', '文章目录');
    float.innerHTML = '<p class="toc-h">本文目录</p>' + (ol ? ol.outerHTML : '');
    document.body.appendChild(float);

    var inlineLinks = [].slice.call(toc.querySelectorAll('a'));
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
      for (var k = 0; k < inlineLinks.length; k++) inlineLinks[k].classList.toggle('on', k === active);
    }
    window.addEventListener('scroll', function () {
      if (spyTick) return;
      spyTick = true;
      requestAnimationFrame(spy);
    }, { passive: true });
    spy();

    /* ---------- 手机端目录抽屉（≤760px 显示呼出按钮） ---------- */
    if (inlineLinks.length) {
      var mBtn = document.createElement('button');
      mBtn.type = 'button';
      mBtn.className = 'toc-m-btn';
      mBtn.setAttribute('aria-label', '打开本文目录');
      mBtn.setAttribute('aria-expanded', 'false');
      mBtn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/></svg>';
      document.body.appendChild(mBtn);

      var mask = document.createElement('div');
      mask.className = 'toc-mask';
      var sheet = document.createElement('nav');
      sheet.className = 'toc-sheet';
      sheet.setAttribute('aria-label', '本文目录');
      sheet.innerHTML = '<p class="toc-h">本文目录</p>' + (ol ? ol.outerHTML : '');
      document.body.appendChild(mask);
      document.body.appendChild(sheet);

      var sheetLinks = [].slice.call(sheet.querySelectorAll('a'));
      var setSheet = function (open) {
        sheet.classList.toggle('open', open);
        mask.classList.toggle('open', open);
        mBtn.setAttribute('aria-expanded', String(open));
        if (open) {
          var activeIdx = -1;
          for (var i = 0; i < targets.length; i++) {
            if (targets[i] && targets[i].getBoundingClientRect().top <= 150) activeIdx = i;
          }
          for (var j = 0; j < sheetLinks.length; j++) sheetLinks[j].classList.toggle('on', j === activeIdx);
        }
      };
      mBtn.addEventListener('click', function () { setSheet(!sheet.classList.contains('open')); });
      mask.addEventListener('click', function () { setSheet(false); });
      sheet.addEventListener('click', function (e) {
        if (e.target.closest('a')) setSheet(false);
      });
    }
  }

  /* ---------- 全站搜索面板 ---------- */
  var GUIDES_ = (typeof GUIDES !== 'undefined') ? GUIDES : null;
  var GAMES_ = (typeof GAMES !== 'undefined') ? GAMES : null;
  var CATS_ = (typeof CATS !== 'undefined') ? CATS : null;

  if (GUIDES_ && GAMES_ && CATS_) {
    (function () {
      function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      var BASE = document.body.getAttribute('data-guide-id') ? '../' : '';

      function bodyText(gi) {
        var s = '';
        for (var i = 0; i < gi.blocks.length; i++) {
          var b = gi.blocks[i];
          if (b.t === 'table') s += ' ' + b.head.join(' ') + ' ' + b.rows.map(function (r) { return r.join(' '); }).join(' ') + ' ';
          else if (Array.isArray(b.v)) s += ' ' + b.v.join(' ') + ' ';
          else s += ' ' + b.v + ' ';
        }
        return s.replace(/\s+/g, ' ').trim();
      }
      var INDEX = GUIDES_.map(function (gi) {
        var body = bodyText(gi);
        return {
          gi: gi,
          title: gi.title.toLowerCase(),
          summary: (gi.dek + ' ' + gi.take.join(' ')).toLowerCase(),
          body: body.toLowerCase(),
          raw: body
        };
      });

      var palMask = document.createElement('div');
      palMask.className = 'pal-mask';
      var pal = document.createElement('div');
      pal.className = 'pal';
      pal.setAttribute('role', 'dialog');
      pal.setAttribute('aria-modal', 'true');
      pal.setAttribute('aria-label', '全站搜索');
      pal.innerHTML = '<div class="pal-head">'
        + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>'
        + '<input class="pal-input" type="text" placeholder="搜 ' + GUIDES_.length + ' 篇攻略：标题、结论、正文都查" autocomplete="off" aria-label="搜索攻略">'
        + '<span class="pal-kbd">ESC</span></div>'
        + '<div class="pal-body"><p class="pal-hint" id="palHint"></p><ul class="pal-list" id="palList" role="listbox" aria-label="搜索结果"></ul></div>'
        + '<div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>⌘K</kbd> 随时呼出</span></div>';
      document.body.appendChild(palMask);
      document.body.appendChild(pal);

      var input = pal.querySelector('.pal-input');
      var list = pal.querySelector('.pal-list');
      var hint = pal.querySelector('#palHint');
      var items = [];
      var active = 0;
      var lastFocus = null;

      function hlSafe(text, tokens) {
        var safe = esc(text);
        tokens.forEach(function (t) {
          if (!t) return;
          var re = new RegExp('(' + esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
          safe = safe.replace(re, '<mark>$1</mark>');
        });
        return safe;
      }
      function snippet(raw, tokens) {
        var low = raw.toLowerCase();
        var at = -1;
        for (var i = 0; i < tokens.length; i++) {
          var p = low.indexOf(tokens[i]);
          if (p > -1 && (at === -1 || p < at)) at = p;
        }
        if (at === -1) return '';
        var start = Math.max(0, at - 24);
        var str = raw.slice(start, start + 74);
        return (start > 0 ? '…' : '') + str + (start + 74 < raw.length ? '…' : '');
      }

      function search(q) {
        var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
        if (!tokens.length) {
          var byId = {};
          INDEX.forEach(function (r) { byId[r.gi.id] = r; });
          var favs = book.all().slice(-6).reverse().map(function (id) { return byId[id]; }).filter(Boolean);
          var recents = read.all().slice(-6).reverse().map(function (id) { return byId[id]; }).filter(Boolean);
          var pool = favs.length ? favs : recents;
          hint.textContent = favs.length ? '我的收藏' : (recents.length ? '最近阅读' : '全部攻略');
          return (pool.length ? pool : INDEX.slice(0, 6)).map(function (r) { return { r: r, snip: '' }; });
        }
        var out = [];
        INDEX.forEach(function (r) {
          var score = 0;
          for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            if (r.title.indexOf(t) > -1) score += 100;
            else if (r.summary.indexOf(t) > -1) score += 45;
            else if (r.body.indexOf(t) > -1) score += 18;
            else return;
          }
          out.push({ r: r, score: score, snip: snippet(r.raw, tokens) });
        });
        out.sort(function (a, b) { return b.score - a.score; });
        hint.textContent = out.length ? '找到 ' + out.length + ' 篇' : '没有匹配结果';
        return out.slice(0, 8);
      }

      function paint() {
        var lis = list.querySelectorAll('.pal-item');
        for (var i = 0; i < lis.length; i++) {
          lis[i].setAttribute('aria-selected', String(i === active));
          if (i === active && lis[i].scrollIntoView) lis[i].scrollIntoView({ block: 'nearest' });
        }
      }
      function render(q) {
        var rows = search(q);
        var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
        if (!rows.length) {
          list.innerHTML = '<li class="pal-empty">没找到相关攻略，换个说法试试</li>';
          items = [];
          active = -1;
          return;
        }
        items = rows.map(function (x) { return x.r; });
        if (active < 0 || active >= items.length) active = 0;
        list.innerHTML = rows.map(function (row, i) {
          var gi = row.r.gi;
          return '<li class="pal-item" role="option" data-i="' + i + '" data-id="' + gi.id + '" aria-selected="' + (i === active) + '">'
            + '<span class="pal-idx">' + (i + 1) + '</span>'
            + '<span class="pal-main">'
            + '<span class="pal-t">' + hlSafe(gi.title, tokens) + '</span>'
            + '<span class="pal-meta">' + esc(GAMES_[gi.game].name) + ' · ' + esc(CATS_[gi.cat]) + ' · ' + esc(gi.level) + (book.has(gi.id) ? ' · ★ 已收藏' : '') + '</span>'
            + (row.snip ? '<span class="pal-snip">' + hlSafe(row.snip, tokens) + '</span>' : '')
            + '</span></li>';
        }).join('');
        paint();
      }
      function go(id) {
        if (!id) return;
        window.location.href = BASE + 'a/' + id + '/';
      }
      function open() {
        if (pal.classList.contains('open')) return;
        lastFocus = document.activeElement;
        pal.classList.add('open');
        palMask.classList.add('open');
        docEl.style.overflow = 'hidden';
        input.value = '';
        active = 0;
        render('');
        setTimeout(function () { input.focus(); }, 40);
      }
      function close() {
        pal.classList.remove('open');
        palMask.classList.remove('open');
        docEl.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }

      var debounce = 0;
      input.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          active = 0;
          render(input.value.trim());
        }, 70);
      });
      pal.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!items.length) return;
          active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          paint();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (items[active]) go(items[active].gi.id);
        } else if (e.key === 'Escape') {
          close();
        }
      });
      pal.addEventListener('mousemove', function (e) {
        var li = e.target.closest('.pal-item');
        if (!li) return;
        var i = Number(li.dataset.i);
        if (i !== active) { active = i; paint(); }
      });
      pal.addEventListener('click', function (e) {
        var li = e.target.closest('.pal-item');
        if (li) go(li.dataset.id);
      });
      palMask.addEventListener('click', close);

      document.addEventListener('keydown', function (e) {
        var tag = (e.target && e.target.tagName) || '';
        var inField = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable);
        if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (pal.classList.contains('open')) close(); else open();
          return;
        }
        if (e.key === '/' && !inField && !document.getElementById('searchInput') && !pal.classList.contains('open')) {
          e.preventDefault();
          open();
        }
      });

      /* 顶栏的搜索按钮（手机端只有这个入口） */
      document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-palette]');
        if (!b) return;
        e.preventDefault();
        open();
      });

      window.GLPalette = { open: open, close: close };

      /* 收藏变化时，若面板正开着（空输入展示收藏），同步刷新 */
      document.addEventListener('gl:bookchange', function () {
        if (pal.classList.contains('open') && !input.value.trim()) render('');
      });
    })();
  }

  /* ---------- 已读 + 阅读位置 ---------- */
  var gid = document.body.getAttribute('data-guide-id');
  /* 首页没有 guide id：跳过已读记录，但不能 return，否则会中断后面所有初始化 */
  if (gid) {

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
  }

  /* ---------- 视觉特效：段落入场 / 光标高光 / 图片淡入 / 标题锚点 ---------- */
  (function fx() {
    if (reduce) return;

    /* 1. 正文逐块入场：首屏内不动（避免闪一下），只处理下方内容 */
    var blocks = [].slice.call(document.querySelectorAll('.prose > *, .takeaways, .related, .share, .navpair'));
    if (blocks.length) {
      var art = document.querySelector('.article');
      if (art) art.classList.add('fx-parent');
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          var i = 0;
          for (var n = 0; n < entries.length; n++) {
            var en = entries[n];
            if (!en.isIntersecting) continue;
            en.target.style.transitionDelay = Math.min(i++ * 45, 180) + 'ms';
            en.target.classList.add('fx-in');
            io.unobserve(en.target);
          }
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
        var fold = window.innerHeight * 0.85;
        for (var b = 0; b < blocks.length; b++) {
          var el = blocks[b];
          var top = el.getBoundingClientRect ? el.getBoundingClientRect().top : 0;
          if (top < fold) continue; /* 已在首屏：直接可见，不做位移动画 */
          el.classList.add('fx');
          io.observe(el);
        }
      }
    }

    /* 2. 卡片光标跟随高光（仅精确指针设备；卡片多为 JS 后渲染，按需挂类） */
    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      var GLOW_SEL = '.entry, .game-card, .poster, .related a';
      var raf = 0, target = null, px = 0, py = 0;
      document.addEventListener('mousemove', function (e) {
        var host = e.target && e.target.closest ? e.target.closest(GLOW_SEL) : null;
        if (!host) return;
        if (!host.classList.contains('glow-host')) host.classList.add('glow-host');
        target = host; px = e.clientX; py = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          if (!target) return;
          var r = target.getBoundingClientRect();
          if (!r.width || !r.height) return;
          target.style.setProperty('--mx', ((px - r.left) / r.width * 100).toFixed(1) + '%');
          target.style.setProperty('--my', ((py - r.top) / r.height * 100).toFixed(1) + '%');
        });
      }, { passive: true });
    }

    /* 2.5 3D 倾斜：鼠标在卡片上移动时朝光标方向轻微翻转（仅精确指针设备） */
    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      var TILT_SEL = '.poster, .entry, .game-card, .related a';
      var MAX_TILT = 7;          /* 单边最大角度 */
      var tHost = null, tRaf = 0, tX = 0, tY = 0;
      var tReset = function (el) {
        if (!el) return;
        el.classList.remove('tilt-on');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      };
      document.addEventListener('pointermove', function (e) {
        var el = e.target && e.target.closest ? e.target.closest(TILT_SEL) : null;
        if (el !== tHost) {
          tReset(tHost);
          tHost = el;
          if (tHost) tHost.classList.add('tilt-on');
        }
        if (!tHost) return;
        tX = e.clientX; tY = e.clientY;
        if (tRaf) return;
        tRaf = requestAnimationFrame(function () {
          tRaf = 0;
          if (!tHost) return;
          var r = tHost.getBoundingClientRect();
          if (!r.width || !r.height) return;
          var px = (tX - r.left) / r.width - 0.5;
          var py = (tY - r.top) / r.height - 0.5;
          tHost.style.setProperty('--ry', (px * MAX_TILT * 2).toFixed(2) + 'deg');
          tHost.style.setProperty('--rx', (-py * MAX_TILT * 2).toFixed(2) + 'deg');
        });
      }, { passive: true });
      document.addEventListener('mouseleave', function () { tReset(tHost); tHost = null; });
      window.addEventListener('blur', function () { tReset(tHost); tHost = null; });
    }

    /* 2.6 3D 入场：触屏设备上卡片滚动进视口时翻正（桌面上由倾斜接管，不重复动）
       卡片由 inline 脚本在本文件之后渲染，所以延到 DOMContentLoaded 再挂 */
    function initCards3d() {
      if (!(window.matchMedia && window.matchMedia('(hover:none)').matches && 'IntersectionObserver' in window)) return;
      var c3d = [].slice.call(document.querySelectorAll('.entry, .game-card'));
      if (c3d.length) {
        var io3 = new IntersectionObserver(function (entries) {
          for (var n = 0; n < entries.length; n++) {
            var en = entries[n];
            if (!en.isIntersecting) continue;
            var el3 = en.target;
            el3.classList.add('c3d-in');
            el3.addEventListener('animationend', function () {
              this.classList.remove('c3d', 'c3d-in');
              this.style.removeProperty('opacity');
              this.style.removeProperty('transform');
            }, { once: true });
            io3.unobserve(el3);
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
        for (var c = 0; c < c3d.length; c++) {
          c3d[c].classList.add('c3d');
          io3.observe(c3d[c]);
        }
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCards3d);
    else initCards3d();

    /* 3. 图片淡入 + 加载骨架（首屏 LCP 图跳过，别拖慢首绘） */
    var imgs = [].slice.call(document.querySelectorAll('picture img'));
    for (var k = 0; k < imgs.length; k++) {
      (function (img) {
        if (img.getAttribute('fetchpriority') === 'high') return;
        var pic = img.closest ? img.closest('picture') : null;
        if (pic) pic.classList.add('fx-holder');
        function done() {
          if (pic) pic.classList.add('fx-ready');
          img.classList.add('fx-loaded');
        }
        if (img.complete && img.naturalWidth) { done(); return; }
        img.classList.add('fx-img');
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      })(imgs[k]);
    }

    /* 3.5 首屏海报视差：滚动时海报图轻微滞后（±1.6%，手机端同样生效） */
    var hg = document.querySelector('.hero-games');
    if (hg) {
      var pyTick = false;
      var pyUpdate = function () {
        pyTick = false;
        var r = hg.getBoundingClientRect();
        var vh = window.innerHeight || 0;
        /* 0 = 刚进视口，1 = 整块滚出视口上方 */
        var p = (vh - r.top) / (vh + r.height);
        p = p < 0 ? 0 : (p > 1 ? 1 : p);
        hg.style.setProperty('--py', ((p - 0.5) * 3.2).toFixed(2) + '%');
      };
      var pyOnScroll = function () {
        if (pyTick) return;
        pyTick = true;
        requestAnimationFrame(pyUpdate);
      };
      window.addEventListener('scroll', pyOnScroll, { passive: true });
      window.addEventListener('resize', pyOnScroll);
      pyUpdate();
    }

    /* 4. 小节标题锚点：悬停出 #，点击复制本节直达链接 */
    var heads = [].slice.call(document.querySelectorAll('.prose h2[id]'));
    for (var j = 0; j < heads.length; j++) {
      (function (hd) {
        var a = document.createElement('a');
        a.className = 'h-anchor';
        a.href = '#' + hd.id;
        a.textContent = '#';
        a.setAttribute('aria-label', '复制本节链接');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var url = location.origin + location.pathname + '#' + hd.id;
          copyText(url).then(function (ok) {
            toast(ok ? '本节链接已复制' : '复制失败，请手动复制地址栏');
          });
          if (history.replaceState) history.replaceState(null, '', '#' + hd.id);
          if (hd.scrollIntoView) hd.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        hd.appendChild(a);
      })(heads[j]);
    }
  })();

})();
