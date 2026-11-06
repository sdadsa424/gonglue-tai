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
      for (var j = 0; j < links.length; j++) {
        var on = j === active;
        links[j].classList.toggle('on', on);
        /* 目录高亮同步给读屏：当前读到哪一节 */
        if (on) links[j].setAttribute('aria-current', 'location'); else links[j].removeAttribute('aria-current');
      }
      for (var k = 0; k < inlineLinks.length; k++) {
        var on2 = k === active;
        inlineLinks[k].classList.toggle('on', on2);
        if (on2) inlineLinks[k].setAttribute('aria-current', 'location'); else inlineLinks[k].removeAttribute('aria-current');
      }
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
      var lastTocFocus = null;
      var setSheet = function (open, restoreFocus) {
        sheet.classList.toggle('open', open);
        mask.classList.toggle('open', open);
        mBtn.setAttribute('aria-expanded', String(open));
        if (open) {
          lastTocFocus = document.activeElement;
          var activeIdx = -1;
          for (var i = 0; i < targets.length; i++) {
            if (targets[i] && targets[i].getBoundingClientRect().top <= 150) activeIdx = i;
          }
          for (var j = 0; j < sheetLinks.length; j++) {
            var onS = j === activeIdx;
            sheetLinks[j].classList.toggle('on', onS);
            if (onS) sheetLinks[j].setAttribute('aria-current', 'location'); else sheetLinks[j].removeAttribute('aria-current');
          }
          /* 抽屉打开时把焦点送进去，键盘/读屏用户才不用自己找 */
          setTimeout(function () { if (sheetLinks[0]) { try { sheetLinks[0].focus({ preventScroll: true }); } catch (e) { sheetLinks[0].focus(); } } }, 60);
        } else if (restoreFocus) {
          /* 点链接关闭时不抢焦点，让浏览器把焦点交给跳转目标 */
          var back = (lastTocFocus && lastTocFocus.focus) ? lastTocFocus : mBtn;
          try { back.focus({ preventScroll: true }); } catch (e2) { try { back.focus(); } catch (e3) {} }
        }
      };
      mBtn.addEventListener('click', function () { setSheet(!sheet.classList.contains('open'), true); });
      mask.addEventListener('click', function () { setSheet(false, true); });
      sheet.addEventListener('click', function (e) {
        if (e.target.closest('a')) setSheet(false, false);
      });
      /* Esc 收起目录抽屉（手机端也常接外接键盘） */
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sheet.classList.contains('open')) setSheet(false, true);
      });
    }
  }

  /* ---------- 全站搜索面板 ---------- */
  var GUIDES_ = (typeof GUIDES !== 'undefined') ? GUIDES : null;
  var GAMES_ = (typeof GAMES !== 'undefined') ? GAMES : null;
  var CATS_ = (typeof CATS !== 'undefined') ? CATS : null;

  var palBooted = false;
  function bootPalette(autoOpen) {
    if (palBooted) return;
    palBooted = true;
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
        + '<input class="pal-input" type="text" placeholder="搜 ' + GUIDES_.length + ' 篇攻略：标题、结论、正文都查" autocomplete="off" aria-label="搜索攻略" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="palList">'
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
        /* 焦点留在输入框，用 aria-activedescendant 告诉读屏"当前选到第几条" */
        if (lis.length && lis[active] && lis[active].id) input.setAttribute('aria-activedescendant', lis[active].id);
        else input.removeAttribute('aria-activedescendant');
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
          return '<li class="pal-item" id="pal-opt-' + i + '" role="option" data-i="' + i + '" data-id="' + gi.id + '" aria-selected="' + (i === active) + '">'
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
        input.setAttribute('aria-expanded', 'true');
        active = 0;
        render('');
        setTimeout(function () { input.focus(); }, 40);
      }
      function close() {
        pal.classList.remove('open');
        palMask.classList.remove('open');
        docEl.style.overflow = '';
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
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
        } else if (e.key === 'Tab') {
          /* 弹层是模态的：Tab 不该跑到背后被遮住的页面上，上下键负责选项 */
          e.preventDefault();
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

    if (autoOpen) open();
  }

  if (GUIDES_ && GAMES_ && CATS_) {
    bootPalette(false);
  } else {
    /* 文章页 / 分站页：data.js（48K）不随首屏加载，点搜索或按 Ctrl/⌘+K 时再拉 */
    var loadPalette = function () {
      if (palBooted) { if (window.GLPalette) window.GLPalette.open(); return; }
      if (document.getElementById('gl-data-script')) return;
      var sc = document.createElement('script');
      sc.id = 'gl-data-script';
      sc.src = (document.body.getAttribute('data-guide-id') ? '../..' : '.') + '/assets/data.js';
      sc.onload = function () { bootPalette(true); };
      document.head.appendChild(sc);
    };
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-palette]')) { e.preventDefault(); loadPalette(); }
    });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); loadPalette(); return; }
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && !document.getElementById('searchInput')) { e.preventDefault(); loadPalette(); }
    });
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

    /* 2.5 3D 倾斜：鼠标在卡片上移动时朝光标方向轻微翻转（仅精确指针设备）
       平滑做法：rAF 逐帧向目标角度插值（lerp），追踪期间用 .tilt-track 关掉
       transform 过渡，避免"每帧重启 transition"造成的抖动/追赶感 */
    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var TILT_SEL = '.poster, .entry, .game-card, .related a';
      var MAX_TILT = 7;          /* 单边最大角度 */
      var LERP = 0.18;           /* 每帧向目标逼近的比例，越小越"跟手柔" */
      var EPS = 0.03;            /* 归位判定阈值（度/像素） */
      var live = [];             /* 正在动画的卡片状态 {el,x,y,l,tx,ty,tl,hover} */
      var tRaf = 0;

      var findLive = function (el) {
        for (var i = 0; i < live.length; i++) if (live[i].el === el) return live[i];
        return null;
      };
      var step = function () {
        tRaf = 0;
        var pending = false;
        for (var i = live.length - 1; i >= 0; i--) {
          var it = live[i];
          it.x += (it.tx - it.x) * LERP;
          it.y += (it.ty - it.y) * LERP;
          it.l += (it.tl - it.l) * LERP;
          var done = Math.abs(it.tx - it.x) < EPS && Math.abs(it.ty - it.y) < EPS && Math.abs(it.tl - it.l) < EPS;
          if (done) { it.x = it.tx; it.y = it.ty; it.l = it.tl; }
          it.el.style.setProperty('--rx', it.x.toFixed(2) + 'deg');
          it.el.style.setProperty('--ry', it.y.toFixed(2) + 'deg');
          it.el.style.setProperty('--lift', it.l.toFixed(2) + 'px');
          if (done && !it.hover) {
            /* 完全归位：清掉内联变量与类，交还 CSS 的 hover 过渡 */
            it.el.classList.remove('tilt-on', 'tilt-track');
            it.el.style.removeProperty('--rx');
            it.el.style.removeProperty('--ry');
            it.el.style.removeProperty('--lift');
            live.splice(i, 1);
          } else if (!done) {
            pending = true;
          }
        }
        if (pending) tRaf = requestAnimationFrame(step);
      };
      var kick = function () { if (!tRaf) tRaf = requestAnimationFrame(step); };

      var activate = function (el, e) {
        var it = findLive(el);
        if (!it) {
          /* 首次进入：读取该卡在 CSS 里定义的悬浮高度（--lift-h），从 0 平滑升到目标 */
          var lh = 0;
          try { lh = parseFloat(window.getComputedStyle(el).getPropertyValue('--lift-h')) || 0; } catch (_) {}
          it = { el: el, x: 0, y: 0, l: 0, tx: 0, ty: 0, tl: lh, hover: true };
          el.classList.add('tilt-on', 'tilt-track');
          live.push(it);
        } else {
          it.hover = true;
        }
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        it.tx = -py * MAX_TILT * 2;
        it.ty = px * MAX_TILT * 2;
        kick();
      };
      var deactivate = function (el) {
        var it = findLive(el);
        if (!it) {
          el.classList.remove('tilt-on', 'tilt-track');
          return;
        }
        it.hover = false;
        it.tx = 0; it.ty = 0; it.tl = 0;
        kick();
      };
      document.addEventListener('pointermove', function (e) {
        var el = e.target && e.target.closest ? e.target.closest(TILT_SEL) : null;
        if (el) activate(el, e);
        for (var i = live.length - 1; i >= 0; i--) {
          if (live[i].el !== el && live[i].hover) deactivate(live[i].el);
        }
      }, { passive: true });
      document.addEventListener('mouseleave', function () {
        for (var i = live.length - 1; i >= 0; i--) deactivate(live[i].el);
      });
      window.addEventListener('blur', function () {
        for (var i = live.length - 1; i >= 0; i--) deactivate(live[i].el);
      });
    }

    /* 2.6 3D 入场：触屏设备上卡片滚动进视口时翻正（桌面上由倾斜接管，不重复动）
       名单只放"没有自带入场动画"的卡片：
       - .entries .entry 自带 riseIn 错峰、.game-card 自带 reveal（特异性都高于 .c3d-in），
         若叠加 .c3d（opacity:0），自带动画播完会回落到透明 → 列表"闪现后空白"
       - .poster 有 reveal.in 兜底（特异性更高，能救回）；.related a 无自带动画 */
    function initCards3d() {
      if (!(window.matchMedia && window.matchMedia('(hover:none) and (prefers-reduced-motion: no-preference)').matches && 'IntersectionObserver' in window)) return;
      var c3d = [].slice.call(document.querySelectorAll('.poster, .related a'));
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

  /* ---------- 顶栏：当地时间 + 天气（IP 定位 → open-meteo，本地缓存 30 分钟） ----------
     拿不到就只留时钟，不报错、不弹提示；不存储任何个人信息 */
  (function clockWeather() {
    var box = document.getElementById('wt');
    if (!box) return;
    var hEl = box.querySelector('[data-wt-h]');
    var mEl = box.querySelector('[data-wt-m]');
    var wxEl = box.querySelector('[data-wt-wx]');
    var icoEl = box.querySelector('[data-wt-ico]');
    var tEl = box.querySelector('[data-wt-temp]');
    var cityEl = box.querySelector('[data-wt-city]');
    if (!hEl || !mEl) return;

    /* 定位面板（与胶囊同在顶栏右簇里） */
    var pop = document.getElementById('wt-pop');
    var curEl = pop && pop.querySelector('[data-wt-cur]');
    var srcEl = pop && pop.querySelector('[data-wt-src]');
    var tipEl = pop && pop.querySelector('[data-wt-tip]');
    var closeBtn = pop && pop.querySelector('[data-wt-close]');
    var gpsBtn = pop && pop.querySelector('[data-wt-gps]');
    var autoBtn = pop && pop.querySelector('[data-wt-auto]');
    var qEl = pop && pop.querySelector('[data-wt-q]');
    var resEl = pop && pop.querySelector('[data-wt-res]');

    /* 1. 时钟：跟随本机时区，跨分钟时分钟位翻一下 */
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    var lastKey = '';
    function tickClock() {
      var d = new Date();
      var key = d.getHours() + ':' + d.getMinutes();
      if (key === lastKey) return;
      var first = lastKey === '';
      lastKey = key;
      hEl.textContent = pad(d.getHours());
      mEl.textContent = pad(d.getMinutes());
      if (!first && !reduce) {
        mEl.classList.remove('wt-tick');
        void mEl.offsetWidth; /* 强制回流，重放动画 */
        mEl.classList.add('wt-tick');
      }
    }
    tickClock();
    setInterval(tickClock, 1000);

    /* 2. 天气图标（内联 SVG，动效在 style.css 里） */
    var ICON = {
      sun: '<svg class="wi wi-sun" viewBox="0 0 32 32"><g class="r" stroke="#FFC65C" stroke-width="2.1" stroke-linecap="round"><path d="M16 3.2v3.6M16 25.2v3.6M3.2 16h3.6M25.2 16h3.6M6.9 6.9l2.5 2.5M22.6 22.6l2.5 2.5M25.1 6.9l-2.5 2.5M9.4 22.6l-2.5 2.5"/></g><circle cx="16" cy="16" r="5.8" fill="#FFC65C"/></svg>',
      moon: '<svg class="wi wi-moon" viewBox="0 0 32 32"><path d="M21.4 3.9a12.2 12.2 0 1 0 6.9 20.3A9.8 9.8 0 0 1 21.4 3.9z" fill="#CBD3F2"/><g class="wi-stars" fill="#FFF8D8"><circle cx="24.8" cy="6.6" r="1.15"/><circle cx="28.6" cy="11.8" r=".85"/></g></svg>',
      partly: '<svg class="wi wi-partly" viewBox="0 0 32 32"><g class="r" stroke="#FFC65C" stroke-width="2" stroke-linecap="round"><path d="M12 3.4v3M3.6 12.4h3M6.4 6.8l2.1 2.1M16.6 6.8l-2.1 2.1M6.4 18l2.1-2.1"/></g><circle cx="12" cy="12.4" r="4.3" fill="#FFC65C"/><g class="wi-cloud"><path d="M12.4 25.6h13.2a3.9 3.9 0 0 0 .3-7.8 5.9 5.9 0 0 0-11.1-1.2 4.3 4.3 0 0 0-2.4 9z" fill="#DDE3F6"/></g></svg>',
      cloudy: '<svg class="wi wi-cloudy" viewBox="0 0 32 32"><path d="M13 20.2h12.6a3.7 3.7 0 0 0 .3-7.4 5.7 5.7 0 0 0-10.7-1.2A4.1 4.1 0 0 0 13 20.2z" fill="#9FA9C9" opacity=".5"/><g class="wi-cloud"><path d="M6.6 27.2h14.8a4.2 4.2 0 0 0 .4-8.4 6.3 6.3 0 0 0-11.9-1.4 4.6 4.6 0 0 0-3.3 9.8z" fill="#DDE3F6"/></g></svg>',
      fog: '<svg class="wi wi-fog" viewBox="0 0 32 32"><path d="M8 15.8h14a4 4 0 0 0 .2-7.9 6 6 0 0 0-11.3-1.2A4.4 4.4 0 0 0 8 15.8z" fill="#DDE3F6" opacity=".85"/><g stroke="#A9B2CE" stroke-width="2" stroke-linecap="round"><path class="f" d="M7 20.6h16"/><path class="f f2" d="M9 24.4h13"/><path class="f f3" d="M11 28.2h10"/></g></svg>',
      rain: '<svg class="wi wi-rain" viewBox="0 0 32 32"><path d="M7 17.9h14.6a4.1 4.1 0 0 0 .3-8.2 6.2 6.2 0 0 0-11.7-1.3A4.5 4.5 0 0 0 7 17.9z" fill="#DDE3F6"/><g stroke="#7FB2FF" stroke-width="2" stroke-linecap="round"><path class="d" d="M11.2 21.4l-1 3.4"/><path class="d d2" d="M16.2 21.4l-1 3.4"/><path class="d d3" d="M21.2 21.4l-1 3.4"/></g></svg>',
      snow: '<svg class="wi wi-snow" viewBox="0 0 32 32"><path d="M7 17.9h14.6a4.1 4.1 0 0 0 .3-8.2 6.2 6.2 0 0 0-11.7-1.3A4.5 4.5 0 0 0 7 17.9z" fill="#DDE3F6"/><g fill="#BFE3FF"><circle class="s" cx="11.2" cy="23" r="1.25"/><circle class="s s2" cx="16.2" cy="24.6" r="1.05"/><circle class="s s3" cx="21.2" cy="23" r="1.2"/></g></svg>',
      storm: '<svg class="wi wi-storm" viewBox="0 0 32 32"><g class="wi-cloud"><path d="M7 17.4h14.6a4.1 4.1 0 0 0 .3-8.2 6.2 6.2 0 0 0-11.7-1.3A4.5 4.5 0 0 0 7 17.4z" fill="#C9D1EC"/></g><path class="wi-bolt" d="M16.8 18.6l-4.4 6.4h3.2l-1.6 4.8 5.4-6.8h-3.4z" fill="#FFC65C"/></svg>'
    };
    var TEXT = {
      0: '晴', 1: '少云', 2: '多云', 3: '阴', 45: '有雾', 48: '雾凇',
      51: '毛毛雨', 53: '小雨', 55: '中雨', 56: '冻雨', 57: '冻雨',
      61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨',
      71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
      80: '阵雨', 81: '强阵雨', 82: '暴雨', 85: '阵雪', 86: '强阵雪',
      95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '雷雨冰雹'
    };
    function kindOf(code, day) {
      if (code === 0) return day ? 'sun' : 'moon';
      if (code === 1 || code === 2) return day ? 'partly' : 'cloudy';
      if (code === 3) return 'cloudy';
      if (code === 45 || code === 48) return 'fog';
      if (code >= 51 && code <= 67) return 'rain';
      if (code >= 71 && code <= 77) return 'snow';
      if (code >= 80 && code <= 82) return 'rain';
      if (code === 85 || code === 86) return 'snow';
      if (code >= 95) return 'storm';
      return day ? 'partly' : 'cloudy';
    }

    /* 3. 定位与取数：默认按 IP 估算，用户可改用浏览器精确定位或手动选城市 */
    var KEY = 'gl_wx_v1', TTL = 30 * 60 * 1000, LOC_KEY = 'gl_loc_v1';
    var busy = false, again = false, lastPos = null, ipCity = '';

    function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function writeJSON(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }
    function dropKey(k) { try { localStorage.removeItem(k); } catch (e) {} }

    /* 用户固定下来的位置（手动选城市 / 精确定位）；没有则返回 null，表示按 IP */
    function savedLoc() {
      var o = readJSON(LOC_KEY);
      if (o && typeof o.lat === 'number' && typeof o.lon === 'number') return o;
      return null;
    }
    function readCache() {
      var o = readJSON(KEY);
      if (!o || typeof o.temp !== 'number' || Date.now() - o.t >= TTL) return null;
      var s = savedLoc(), src = o.src || 'ip';                 /* 老缓存没 src，一律当 IP 结果 */
      if (s) {
        if (src === 'ip') return null;                         /* 已固定位置，IP 的缓存作废 */
        if (typeof o.lat !== 'number' || typeof o.lon !== 'number') return null;
        if (Math.abs(o.lat - s.lat) > 0.01 || Math.abs(o.lon - s.lon) > 0.01) return null;
      } else if (src !== 'ip') {
        return null;                                           /* 已取消固定，固定位置的缓存作废 */
      }
      return o;
    }
    function getJSON(url, ms) {
      if (!window.fetch) return Promise.reject(new Error('no fetch'));
      var opt = { cache: 'no-store' };
      var C = window.AbortController, timer = 0;
      if (C) { var ac = new C(); opt.signal = ac.signal; timer = setTimeout(function () { ac.abort(); }, ms || 7000); }
      return fetch(url, opt).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (j) { if (timer) clearTimeout(timer); return j; },
              function (e) { if (timer) clearTimeout(timer); throw e; });
    }
    function locateByIP() {
      return getJSON('https://ipwho.is/?fields=success,latitude,longitude,city', 6000)
        .then(function (j) {
          if (!j || j.success === false || !j.latitude) throw new Error('geo');
          ipCity = j.city || '';
          return { lat: j.latitude, lon: j.longitude, city: ipCity, src: 'ip' };
        })
        .catch(function () {
          return getJSON('https://ipapi.co/json/', 6000).then(function (j) {
            if (!j || !j.latitude) throw new Error('geo2');
            ipCity = j.city || '';
            return { lat: j.latitude, lon: j.longitude, city: ipCity, src: 'ip' };
          });
        });
    }
    function currentPos() {
      var s = savedLoc();
      return s ? Promise.resolve(s) : locateByIP();
    }

    /* 4. 渲染 */
    var SRC_TEXT = { ip: '按网络 IP 估算，可能不准', gps: '浏览器精确定位', manual: '手动选择的城市' };
    function syncPop() {
      if (!curEl) return;
      var o = lastPos;
      curEl.textContent = (o && o.city) ? o.city : '位置未知';
      if (srcEl) srcEl.textContent = (o && SRC_TEXT[o.src]) || SRC_TEXT.ip;
    }
    function render(o) {
      var k = kindOf(o.code, o.day);
      icoEl.innerHTML = ICON[k] || ICON.cloudy;
      tEl.textContent = Math.round(o.temp) + '°';
      wxEl.hidden = false;
      var name = TEXT[o.code] || '天气';
      var deg = Math.round(o.temp) + '°';
      if (cityEl) {
        if (o.city) { cityEl.textContent = o.city; cityEl.hidden = false; }
        else { cityEl.hidden = true; }
      }
      wxEl.title = (o.city ? o.city + ' · ' : '') + name + ' ' + deg + ' · 点击设置定位';
      box.setAttribute('aria-label', '当地时间 ' + lastKey + '，' + (o.city || '本地') + name + ' ' + deg + '，点击设置定位');
      lastPos = o;
      syncPop();
    }
    function load() {
      if (busy) { again = true; return; }
      busy = true;
      currentPos().then(function (pos) {
        return getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + pos.lat.toFixed(3)
          + '&longitude=' + pos.lon.toFixed(3)
          + '&current=temperature_2m,weather_code,is_day&timezone=auto', 7000)
          .then(function (j) {
            var cur = j && j.current;
            if (!cur || typeof cur.temperature_2m !== 'number') throw new Error('wx');
            var o = {
              t: Date.now(), temp: cur.temperature_2m, code: cur.weather_code,
              day: cur.is_day ? 1 : 0, city: pos.city, lat: pos.lat, lon: pos.lon, src: pos.src
            };
            writeJSON(KEY, o);
            render(o);
          });
      }).catch(function () {
        if (!lastPos) wxEl.hidden = true;                      /* 完全拿不到：只留时钟 */
      }).then(function () {
        busy = false;
        if (again) { again = false; load(); }
      });
    }

    /* 5. 定位面板：精确定位 / 手动选城市 / 回到 IP */
    var tipTimer = 0;
    function setTip(msg) {
      if (!tipEl) return;
      tipEl.textContent = msg || '';
      tipEl.hidden = !msg;
      clearTimeout(tipTimer);
      if (msg) tipTimer = setTimeout(function () { tipEl.hidden = true; }, 6000);
    }
    function openPop() {
      if (!pop) return;
      pop.hidden = false;
      if (!reduce) { pop.classList.remove('in'); void pop.offsetWidth; pop.classList.add('in'); }
      box.setAttribute('aria-expanded', 'true');
      syncPop();
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onDocKey, true);
    }
    function closePop() {
      if (!pop) return;
      pop.hidden = true;
      box.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onDocKey, true);
    }
    function onDocClick(e) {
      if ((pop && pop.contains(e.target)) || box.contains(e.target)) return;
      closePop();
    }
    function onDocKey(e) { if (e.key === 'Escape') { closePop(); try { box.focus(); } catch (err) {} } }

    box.addEventListener('click', function () { if (!pop) return; if (pop.hidden) openPop(); else closePop(); });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!pop) return;
      if (pop.hidden) openPop(); else closePop();
    });
    if (closeBtn) closeBtn.addEventListener('click', closePop);

    if (gpsBtn) gpsBtn.addEventListener('click', function () {
      if (!navigator.geolocation) { setTip('这个浏览器不支持精确定位，试试下面的城市搜索'); return; }
      gpsBtn.disabled = true;
      setTip('正在获取你的位置，浏览器可能会弹权限提示…');
      navigator.geolocation.getCurrentPosition(function (p) {
        gpsBtn.disabled = false;
        writeJSON(LOC_KEY, {
          lat: p.coords.latitude, lon: p.coords.longitude,
          city: '我的位置', src: 'gps'
        });
        setTip('已切换为精确定位，正在更新天气…');
        load();
      }, function (err) {
        gpsBtn.disabled = false;
        var c = err && err.code;
        setTip(c === 1 ? '定位权限被拒绝，可在地址栏左侧的图标里重新允许'
             : c === 3 ? '定位超时，换个网络或手动选城市试试'
             : '定位失败，可以按 IP 或手动选城市');
      }, { timeout: 10000, maximumAge: 600000, enableHighAccuracy: false });
    });

    if (autoBtn) autoBtn.addEventListener('click', function () {
      dropKey(LOC_KEY); dropKey(KEY);
      lastPos = null;
      setTip('已恢复按 IP 自动定位');
      load();
    });

    var found = [], qTimer = 0;
    function resMsg(txt) {
      if (!resEl) return;
      resEl.hidden = false;
      resEl.textContent = '';
      var li = document.createElement('li');
      li.className = 'wt-empty';
      li.textContent = txt;
      resEl.appendChild(li);
    }
    function searchCity(q) {
      resMsg('搜索中…');
      getJSON('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q)
        + '&count=6&language=zh&format=json', 6000)
        .then(function (j) {
          found = (j && j.results) || [];
          if (!found.length) { resMsg('没找到这个城市，换个写法试试（也可以打拼音）'); return; }
          resEl.textContent = '';
          found.forEach(function (c, i) {
            var li = document.createElement('li');
            var b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('data-i', String(i));
            var nm = document.createElement('b');
            nm.textContent = c.name;
            var sub = document.createElement('i');
            sub.textContent = [c.admin1, c.country].filter(Boolean).join(' · ');
            b.appendChild(nm); b.appendChild(sub);
            li.appendChild(b);
            resEl.appendChild(li);
          });
        })
        .catch(function () { resMsg('搜索失败，检查网络后再试'); });
    }
    if (qEl) qEl.addEventListener('input', function () {
      clearTimeout(qTimer);
      var q = qEl.value.trim();
      if (!q) { if (resEl) { resEl.hidden = true; resEl.textContent = ''; } return; }
      qTimer = setTimeout(function () { searchCity(q); }, 380);
    });
    if (resEl) resEl.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-i]') : null;
      if (!b) return;
      var c = found[+b.getAttribute('data-i')];
      if (!c) return;
      writeJSON(LOC_KEY, { lat: c.latitude, lon: c.longitude, city: c.name, src: 'manual' });
      if (qEl) qEl.value = '';
      resEl.hidden = true;
      setTip('已切换到 ' + c.name + '，正在更新天气…');
      load();
    });
    if (pop) pop.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-lat]') : null;
      if (!b) return;
      var nm = b.getAttribute('data-n');
      writeJSON(LOC_KEY, {
        lat: parseFloat(b.getAttribute('data-lat')),
        lon: parseFloat(b.getAttribute('data-lon')),
        city: nm, src: 'manual'
      });
      setTip('已切换到 ' + nm + '，正在更新天气…');
      load();
    });

    var cached = readCache();
    if (cached) render(cached); else load();

    /* 回到标签页时：补时钟、缓存过期就重取 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      tickClock();
      if (!readCache()) load();
    });
  })();

  /* ---------- 站内互动：公告 / 点赞 / 留言板 ----------
     后端是 Cloudflare Pages Functions（functions/api/[[path]].js）+ D1。
     接口不可用时（未绑定数据库 / GitHub Pages 副本）全部静默降级，不留报错。 */
  (function social() {
    if (typeof fetch !== 'function') return;   /* 老环境没有 fetch 就整体跳过，不影响攻略阅读 */
    /* 相对站点根的深度：/ → 0，/board/ → 1，/a/x/ → 2 */
    var seg = location.pathname.replace(/[^\/]*$/, '').split('/').filter(Boolean).length;
    var API = new Array(seg + 1).join('../') + 'api';

    function getJSON(url, opt) {
      return fetch(url, opt).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) {
          return { ok: r.ok, status: r.status, data: d };
        });
      });
    }

    function when(iso) {
      var t = new Date(iso).getTime();
      if (!t) return '';
      var gap = Date.now() - t;
      if (gap < 60000) return '刚刚';
      if (gap < 3600000) return Math.floor(gap / 60000) + ' 分钟前';
      if (gap < 86400000) return Math.floor(gap / 3600000) + ' 小时前';
      if (gap < 2592000000) return Math.floor(gap / 86400000) + ' 天前';
      var dt = new Date(t);
      return (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
    }

    function lsGet(k, fb) {
      try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; }
    }
    function lsSet(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }

    /* 1. 公告条：首页插在首屏中央（大标题与海报之间，胶囊特效款），
          其余页面插在顶栏下方（横条款）；关掉后按公告 id 记住，不重复弹 */
    (function notice() {
      var top = document.querySelector('.topbar');
      if (!top) return;
      var heroAnchor = document.querySelector('.hero-in .hero-type');
      getJSON(API + '/notice').then(function (res) {
        if (!res.ok || !res.data || !res.data.items || !res.data.items.length) return;
        var it = res.data.items[0];
        var seen = lsGet('gl_notice_v2', {}) || {};
        if (seen[it.id]) return;

        var box = document.createElement('div');
        box.className = 'notice' + (heroAnchor ? ' notice-hero' : '');
        var inner = document.createElement('div');
        inner.className = 'wrap notice-in';
        var tag = document.createElement('span');
        tag.className = 'notice-tag';
        tag.textContent = '公告';
        var txt = document.createElement('p');
        txt.className = 'notice-txt';
        txt.textContent = it.body;
        var close = document.createElement('button');
        close.className = 'notice-x';
        close.type = 'button';
        close.setAttribute('aria-label', '关闭公告');
        close.textContent = '×';
        close.addEventListener('click', function () {
          box.hidden = true;
          var s = lsGet('gl_notice_v2', {}) || {};
          s[it.id] = 1;
          lsSet('gl_notice_v1', s);
        });
        inner.appendChild(tag); inner.appendChild(txt); inner.appendChild(close);
        box.appendChild(inner);
        if (heroAnchor) heroAnchor.insertAdjacentElement('afterend', box);
        else top.parentNode.insertBefore(box, top.nextSibling);
      }).catch(function () {});
    })();

    /* 2. 点赞：一人一票（本机记录），数字来自服务端 */
    (function votes() {
      var btns = [].slice.call(document.querySelectorAll('[data-like]'));
      if (!btns.length) return;
      var KEY = 'gl_like_v1';
      var mine = lsGet(KEY, {}) || {};
      var row = document.getElementById('voteRow');

      function paint(game, n) {
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].getAttribute('data-like') !== game) continue;
          var el = btns[i].querySelector('[data-like-n]');
          if (el) el.textContent = n;
        }
      }
      function off(msg) {
        if (!row || row.getAttribute('data-off')) return;
        row.setAttribute('data-off', '1');
        var p = document.createElement('p');
        p.className = 'sec-desc';
        p.textContent = msg;
        row.parentNode.insertBefore(p, row.nextSibling);
      }

      btns.forEach(function (b) { b.disabled = true; });

      getJSON(API + '/like').then(function (res) {
        if (!res.ok || !res.data || !res.data.likes) { off('点赞服务暂时不可用，稍后再来。'); return; }
        Object.keys(res.data.likes).forEach(function (g) { paint(g, res.data.likes[g]); });
        btns.forEach(function (b) {
          if (mine[b.getAttribute('data-like')]) b.setAttribute('aria-pressed', 'true');
          b.disabled = false;
        });
      }).catch(function () { off('点赞服务暂时不可用，稍后再来。'); });

      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var g = b.getAttribute('data-like');
          if (mine[g]) { toast('这一票你已经投过啦'); return; }
          b.disabled = true;
          getJSON(API + '/like', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ game: g })
          }).then(function (res) {
            b.disabled = false;
            if (!res.ok || !res.data || typeof res.data.n !== 'number') { toast('没投上，稍后再试'); return; }
            mine[g] = 1;
            lsSet(KEY, mine);
            paint(g, res.data.n);
            b.setAttribute('aria-pressed', 'true');
            b.classList.remove('is-pop');
            void b.offsetWidth;
            b.classList.add('is-pop');
            var nm = b.querySelector('.vote-nm');
            toast('已投给 ' + (nm ? nm.textContent : '这款游戏'));
          }).catch(function () {
            b.disabled = false;
            toast('网络不通，稍后再试');
          });
        });
      });
    })();

    /* 3. 留言板（仅 /board/ 页） */
    (function board() {
      var form = document.getElementById('bdForm');
      var list = document.getElementById('bdList');
      if (!form || !list) return;

      var nameEl = document.getElementById('bdName');
      var bodyEl = document.getElementById('bdBody');
      var countEl = document.getElementById('bdCount');
      var sendEl = document.getElementById('bdSend');
      var msgEl = document.getElementById('bdMsg');
      var offEl = document.getElementById('bdOff');
      var emptyEl = document.getElementById('bdEmpty');
      var loadingEl = document.getElementById('bdLoading');
      var moreEl = document.getElementById('bdMore');
      var MAX = 300;
      var LIMIT = 30;
      var all = [];
      var offset = 0;

      function say(text, kind) {
        msgEl.textContent = text || '';
        msgEl.className = 'bd-msg' + (kind ? ' ' + kind : '');
      }

      function item(c) {
        var li = document.createElement('li');
        li.className = 'bd-item';
        var av = document.createElement('span');
        av.className = 'bd-av';
        av.setAttribute('aria-hidden', 'true');
        var nmText = (c.name || '匿名玩家').trim();
        av.textContent = nmText.charAt(0).toUpperCase();

        var main = document.createElement('div');
        main.className = 'bd-main';
        var head = document.createElement('div');
        head.className = 'bd-top';
        var nm = document.createElement('span');
        nm.className = 'bd-nm';
        nm.textContent = nmText;
        var tm = document.createElement('time');
        tm.className = 'bd-time';
        tm.setAttribute('datetime', c.created_at || '');
        tm.textContent = when(c.created_at);
        head.appendChild(nm);
        head.appendChild(tm);
        var p = document.createElement('p');
        p.className = 'bd-body';
        p.textContent = c.body;

        main.appendChild(head);
        main.appendChild(p);
        li.appendChild(av);
        li.appendChild(main);
        return li;
      }

      function render() {
        list.textContent = '';
        all.forEach(function (c) { list.appendChild(item(c)); });
        emptyEl.hidden = all.length > 0;
      }

      function load(more) {
        getJSON(API + '/comment?limit=' + LIMIT + '&offset=' + offset).then(function (res) {
          loadingEl.hidden = true;
          if (!res.ok) {
            offEl.hidden = false;
            if (moreEl) moreEl.hidden = true;
            if (!all.length) emptyEl.hidden = true;
            return;
          }
          var items = (res.data && res.data.items) || [];
          all = more ? all.concat(items) : items;
          offset += items.length;
          render();
          if (moreEl) moreEl.hidden = items.length < LIMIT;
        }).catch(function () {
          loadingEl.hidden = true;
          offEl.hidden = false;
          if (moreEl) moreEl.hidden = true;
        });
      }

      bodyEl.addEventListener('input', function () {
        var n = bodyEl.value.length;
        countEl.textContent = n + ' / ' + MAX;
        countEl.classList.toggle('over', n >= MAX);
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = bodyEl.value.trim();
        if (!body) { say('写点什么再发吧。', 'err'); bodyEl.focus(); return; }
        if (sendEl.disabled) return;
        sendEl.disabled = true;
        say('正在发送…');
        getJSON(API + '/comment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: nameEl.value.trim(), body: body })
        }).then(function (res) {
          sendEl.disabled = false;
          if (res.ok && res.data && res.data.item) {
            all.unshift(res.data.item);
            offset += 1;
            bodyEl.value = '';
            countEl.textContent = '0 / ' + MAX;
            render();
            say('发布成功，谢谢你。', 'ok');
            return;
          }
          if (res.status === 429) {
            var d = res.data || {};
            say(d.error === 'too_fast' ? '发得有点快，等一分钟再发。' : '今天发得够多了，明天再来。', 'err');
            return;
          }
          if (res.status === 503) {
            offEl.hidden = false;
            say('留言板还没接通服务器。', 'err');
            return;
          }
          say('没发出去，稍后再试。', 'err');
        }).catch(function () {
          sendEl.disabled = false;
          say('网络不通，稍后再试。', 'err');
        });
      });

      if (moreEl) {
        moreEl.addEventListener('click', function () {
          moreEl.disabled = true;
          load(true);
          moreEl.disabled = false;
        });
      }

      load(false);
    })();
  })();

})();
