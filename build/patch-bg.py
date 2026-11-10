# -*- coding: utf-8 -*-
"""炫彩背景 v2 补丁：幂等，可重复执行。
- style.css 为 CRLF：以 bytes 追加，只做一次
- ui.js 为 LF：替换 fxBg() 整个 IIFE
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, 'assets', 'style.css')
JS = os.path.join(ROOT, 'assets', 'ui.js')

CSS_MARK = '/* ============================================================\n   炫彩背景 v2'
JS_MARK = 'fx-hero-aurora'

CSS_BLOCK = r'''/* ============================================================
   炫彩背景 v2 · 流动极光（纯装饰 / 只动 transform+opacity）
   分层：双 mesh 色场 → 彩虹光轮 → 极光丝带 → 网格扫光 → 彩色星尘
   降级：reduce 不动、移动端/低核只留 mesh+星尘、后台标签页暂停
   ============================================================ */
/* 1) 双 mesh 色场：五光源柔渐变，整层慢速旋转+缩放，让颜色"流"起来 */
.fx-mesh{
  position:absolute;left:-30%;top:-30%;width:160%;height:160%;
  background:
    radial-gradient(38% 42% at 22% 26%,rgba(255,61,154,.30),transparent 72%),
    radial-gradient(40% 46% at 78% 22%,rgba(139,92,246,.32),transparent 74%),
    radial-gradient(44% 48% at 72% 58%,rgba(76,154,255,.32),transparent 74%),
    radial-gradient(36% 40% at 16% 62%,rgba(45,212,167,.26),transparent 72%),
    radial-gradient(30% 34% at 50% 34%,rgba(255,176,32,.16),transparent 72%);
  animation:meshFlowA 30s ease-in-out infinite;
  will-change:transform;
}
.fx-mesh.m2{
  background:
    radial-gradient(34% 40% at 66% 20%,rgba(255,122,69,.22),transparent 72%),
    radial-gradient(38% 44% at 24% 66%,rgba(167,139,250,.26),transparent 72%),
    radial-gradient(40% 44% at 82% 78%,rgba(255,61,154,.20),transparent 74%),
    radial-gradient(32% 36% at 44% 24%,rgba(45,212,167,.14),transparent 72%);
  opacity:.8;
  animation:meshFlowB 44s ease-in-out infinite;
}
@keyframes meshFlowA{
  0%,100%{transform:translate3d(-2%,-1%,0) rotate(0deg) scale(1.04)}
  50%{transform:translate3d(3%,2%,0) rotate(11deg) scale(1.16)}
}
@keyframes meshFlowB{
  0%,100%{transform:translate3d(2%,2%,0) rotate(0deg) scale(1.14)}
  50%{transform:translate3d(-3%,-2%,0) rotate(-13deg) scale(1.02)}
}
/* 2) 彩虹光轮：conic 全色相 + 静态大模糊，只旋转纹理，色相沿画面缓缓轮转 */
.fx-iris{
  position:absolute;left:50%;top:50%;width:118vmax;height:118vmax;margin:-59vmax 0 0 -59vmax;
  border-radius:50%;
  background:conic-gradient(from 0deg,
    #FF3D9A 0deg,#FF7A45 48deg,#FFB020 96deg,#2DD4A7 152deg,
    #4C9AFF 208deg,#8B5CF6 264deg,#F45BD0 312deg,#FF3D9A 360deg);
  filter:blur(78px) saturate(150%);
  opacity:.16;
  animation:irisSpin 56s linear infinite;
  will-change:transform;
}
@keyframes irisSpin{
  0%{transform:rotate(0deg) scale(1)}
  50%{transform:rotate(180deg) scale(1.1)}
  100%{transform:rotate(360deg) scale(1)}
}
/* 3) 极光丝带：两条宽扁彩带斜向漂移，一层层掠过画面 */
.fx-ribbon{
  position:absolute;left:-28%;width:156%;height:34vh;top:8%;
  border-radius:50%;
  background:linear-gradient(90deg,transparent,
    rgba(255,61,154,.26) 16%,rgba(255,176,32,.16) 34%,
    rgba(45,212,167,.20) 52%,rgba(76,154,255,.24) 70%,
    rgba(139,92,246,.28) 88%,transparent);
  filter:blur(44px);
  opacity:.6;
  animation:ribbonA 24s ease-in-out infinite;
  will-change:transform;
}
.fx-ribbon.r2{top:52%;height:30vh;opacity:.45;animation:ribbonB 32s ease-in-out infinite}
@keyframes ribbonA{
  0%,100%{transform:translate3d(-4%,0,0) rotate(-8deg) scale(1)}
  50%{transform:translate3d(6%,-6%,0) rotate(6deg) scale(1.14)}
}
@keyframes ribbonB{
  0%,100%{transform:translate3d(4%,2%,0) rotate(7deg) scale(1.08)}
  50%{transform:translate3d(-6%,-4%,0) rotate(-6deg) scale(.98)}
}
/* 4) 网格扫光：一道很淡的彩虹光缓缓下扫，静态网格因此"活"起来 */
.fx-sheen{
  position:absolute;left:-10%;right:-10%;top:0;height:52%;
  background:linear-gradient(180deg,transparent,
    rgba(139,92,246,.055) 38%,rgba(255,61,154,.065) 54%,rgba(76,154,255,.05) 68%,transparent);
  animation:sheenSweep 22s ease-in-out infinite;
}
@keyframes sheenSweep{
  0%{transform:translate3d(0,-110%,0)}
  100%{transform:translate3d(0,220%,0)}
}
/* 5) 星尘彩色化 + 缓慢上浮；颜色取主题环，暗底上只留微光，不抢正文 */
.fx-dust b{
  background:var(--dc,#fff);
  box-shadow:0 0 6px 0 var(--dc,rgba(255,255,255,.6));
  animation:fxTwinkle 8s ease-in-out infinite,dustFloat 22s ease-in-out infinite;
}
@keyframes fxTwinkle{0%,100%{opacity:0}50%{opacity:.72}}
@keyframes dustFloat{
  0%,100%{transform:translate3d(0,0,0) scale(.85)}
  50%{transform:translate3d(7px,-20px,0) scale(1.1)}
}
/* 6) 原有四团极光提饱和、地平线改多色 */
.fx-blob.b1{background:radial-gradient(closest-side,rgba(255,61,154,.26),transparent 72%)}
.fx-blob.b2{background:radial-gradient(closest-side,rgba(139,92,246,.28),transparent 72%)}
.fx-blob.b3{background:radial-gradient(closest-side,rgba(76,154,255,.22),transparent 74%)}
.fx-blob.b4{background:radial-gradient(closest-side,rgba(45,212,167,.18),transparent 72%)}
.fx-horizon{
  background:linear-gradient(90deg,transparent,
    rgba(255,61,154,.16) 22%,rgba(255,176,32,.09) 40%,
    rgba(139,92,246,.18) 62%,rgba(76,154,255,.14) 82%,transparent);
  opacity:.9;
}
/* 7) 首屏：底色半透明，让全站 mesh 透上来；另铺流动极光 + 旋转彩虹光轮 */
.hero{
  background:
    radial-gradient(680px 380px at 16% 4%,rgba(255,61,154,.20),transparent 62%),
    radial-gradient(720px 420px at 84% 0%,rgba(139,92,246,.22),transparent 64%),
    linear-gradient(180deg,rgba(18,16,42,.62) 0%,rgba(11,12,24,.78) 70%,rgba(9,10,18,.90) 100%);
}
.fx-hero{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.hero::before{z-index:1}
.fx-hero-aurora{
  position:absolute;inset:-34% -22%;
  background:
    radial-gradient(42% 62% at 12% 18%,rgba(255,61,154,.30),transparent 70%),
    radial-gradient(40% 60% at 88% 12%,rgba(139,92,246,.32),transparent 72%),
    radial-gradient(46% 64% at 74% 70%,rgba(76,154,255,.32),transparent 72%),
    radial-gradient(38% 56% at 20% 78%,rgba(45,212,167,.26),transparent 72%),
    radial-gradient(30% 40% at 50% 34%,rgba(255,190,92,.17),transparent 72%);
  animation:auroraWave 26s ease-in-out infinite;
  will-change:transform;
}
/* 色相轮：尺寸贴着视口，扇形色区能真正落在首屏左右两侧，缓慢旋转 */
.fx-hero-iris{
  position:absolute;left:50%;top:50%;width:120vw;height:110vh;border-radius:50%;
  background:conic-gradient(from 0deg,
    #FF3D9A 0deg,#FFB020 60deg,#2DD4A7 120deg,#4C9AFF 180deg,
    #8B5CF6 240deg,#F45BD0 300deg,#FF3D9A 360deg);
  filter:blur(70px) saturate(150%);
  opacity:.15;
  animation:heroIrisSpin 58s linear infinite reverse;
  will-change:transform;
}
@keyframes heroIrisSpin{
  0%{transform:translate(-50%,-50%) rotate(0deg) scale(1)}
  50%{transform:translate(-50%,-50%) rotate(180deg) scale(1.12)}
  100%{transform:translate(-50%,-50%) rotate(360deg) scale(1)}
}
.fx-hero-aurora.h2{
  background:
    radial-gradient(40% 52% at 68% 18%,rgba(255,122,69,.18),transparent 72%),
    radial-gradient(42% 54% at 26% 70%,rgba(167,139,250,.24),transparent 72%);
  opacity:.75;
  animation:auroraWave 38s ease-in-out infinite reverse;
}
@keyframes auroraWave{
  0%,100%{transform:translate3d(-3%,-2%,0) rotate(0deg) scale(1.04)}
  33%{transform:translate3d(3%,1%,0) rotate(4deg) scale(1.12)}
  66%{transform:translate3d(-1%,3%,0) rotate(-3deg) scale(1.06)}
}
/* 首屏斜向光带升级成全彩：加宽提亮、周期缩短，色相缓慢轮转 */
.fx-band{
  width:360px;
  background:linear-gradient(90deg,transparent,
    rgba(255,61,154,.22) 18%,rgba(255,176,32,.16) 36%,
    rgba(45,212,167,.17) 54%,rgba(76,154,255,.20) 72%,
    rgba(139,92,246,.22) 90%,transparent);
  filter:blur(9px);
  animation:bandMove 14s ease-in-out infinite,bandHue 20s linear infinite;
}
@keyframes bandHue{
  0%{filter:blur(9px) hue-rotate(0deg)}
  100%{filter:blur(9px) hue-rotate(360deg)}
}
.fx-glow i:nth-child(1){background:radial-gradient(closest-side,rgba(255,61,154,.22),transparent)}
.fx-glow i:nth-child(2){background:radial-gradient(closest-side,rgba(139,92,246,.24),transparent)}
/* 8) 静态光斑让位 / 低性能减层 / 后台暂停 / 减弱动态 */
html.fx-on body::before{opacity:.42}
html.fx-lite .fx-iris,
html.fx-lite .fx-ribbon,
html.fx-lite .fx-sheen,
html.fx-lite .fx-mesh.m2,
html.fx-lite .fx-hero-iris,
html.fx-lite .fx-hero-aurora.h2{display:none}
html.fx-lite .fx-dust b{box-shadow:none}
html.fx-paused .fx-bg *,
html.fx-paused .fx-hero *,
html.fx-paused .fx-stars *,
html.fx-paused .fx-band,
html.fx-paused .fx-glow *{animation-play-state:paused!important}
@media (max-width:760px){
  .fx-iris,.fx-ribbon,.fx-sheen,.fx-hero-iris{display:none}
  .fx-mesh{opacity:.8}
  .fx-hero-aurora{opacity:.85}
  .fx-band{width:220px;animation:bandMove 14s ease-in-out infinite}
}
@media (prefers-reduced-motion:reduce){
  .fx-hero,.fx-mesh,.fx-iris,.fx-ribbon,.fx-sheen,.fx-hero-iris{display:none!important}
  .fx-dust b{animation:none!important}
}
'''

JS_BLOCK = r'''  /* 全站炫彩背景：双 mesh 色场 + 彩虹光轮 + 极光丝带 + 网格扫光 + 彩色星尘。
     首屏 hero 自带不透明底，另铺一层流动极光衔接；reduce / 低核 / 手机自动减层，
     页面切到后台暂停全部装饰动画。纯装饰层，不参与任何交互 */
  (function fxBg() {
    if (!document.body || reduce) return;
    var root = document.documentElement;
    var mq = window.matchMedia;
    var small = !!(mq && mq('(max-width:760px)').matches);
    var lowCpu = !!(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    var lite = small || lowCpu;
    root.classList.add('fx-on');
    if (lite) root.classList.add('fx-lite');

    var bg = document.createElement('div');
    bg.className = 'fx-bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = '<i class="fx-mesh"></i><i class="fx-mesh m2"></i>'
      + '<i class="fx-iris"></i>'
      + '<i class="fx-ribbon"></i><i class="fx-ribbon r2"></i>'
      + '<i class="fx-grid"></i><i class="fx-sheen"></i><i class="fx-dust"></i>'
      + '<i class="fx-blob b1"></i><i class="fx-blob b2"></i>'
      + '<i class="fx-blob b3"></i><i class="fx-blob b4"></i>'
      + '<i class="fx-horizon"></i>';
    document.body.appendChild(bg);

    /* 星尘：颜色取主题环，位置/明灭/上浮周期全部随机，避免看出规律 */
    var COLORS = ['255,61,154', '139,92,246', '76,154,255', '45,212,167', '255,176,32', '255,255,255'];
    var dust = bg.querySelector('.fx-dust'), frag = document.createDocumentFragment();
    var n = lite ? 22 : 54;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('b');
      var sz = (Math.random() * 1.6 + 0.7).toFixed(1);
      var c = COLORS[Math.floor(Math.random() * COLORS.length)];
      s.style.cssText = 'left:' + (Math.random() * 100).toFixed(2) + '%;top:' + (Math.random() * 100).toFixed(2)
        + '%;width:' + sz + 'px;height:' + sz + 'px;--dc:rgba(' + c + ',.85)'
        + ';animation-duration:' + (5 + Math.random() * 7).toFixed(2) + 's,'
        + (18 + Math.random() * 14).toFixed(2) + 's'
        + ';animation-delay:-' + (Math.random() * 10).toFixed(2) + 's,-'
        + (Math.random() * 16).toFixed(2) + 's';
      frag.appendChild(s);
    }
    dust.appendChild(frag);

    var hero = document.querySelector('.hero');
    if (hero) {
      var hv = document.createElement('div');
      hv.className = 'fx-hero';
      hv.setAttribute('aria-hidden', 'true');
      hv.innerHTML = '<i class="fx-hero-iris"></i><i class="fx-hero-aurora"></i><i class="fx-hero-aurora h2"></i>';
      hero.insertBefore(hv, hero.firstChild);
    }

    var ticking = false;
    function upd() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      bg.style.setProperty('--fy', (-y * 0.035).toFixed(1) + 'px');
      bg.style.setProperty('--fy2', (-y * 0.02).toFixed(1) + 'px');
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(upd); }
    }, { passive: true });
    upd();

    /* 切到后台立刻停帧，回来自动续上；不额外耗电 */
    document.addEventListener('visibilitychange', function () {
      root.classList.toggle('fx-paused', !!document.hidden);
    });
  })();

'''


def patch_css():
    raw = open(CSS, 'rb').read()
    # 重放：v2 块恒在文件末尾，从标记处截断后重新追加
    pos = raw.find('/* ============================================================\r\n   炫彩背景 v2'.encode('utf-8'))
    if pos >= 0:
        raw = raw[:pos]
    txt = raw.decode('utf-8')
    block = CSS_BLOCK.replace('\n', '\r\n')
    if not txt.endswith('\r\n'):
        raw += b'\r\n'
    raw += (block + '\r\n').encode('utf-8')
    open(CSS, 'wb').write(raw)
    print('style.css: v2 block written,', len(block), 'chars (CRLF kept)')


def patch_js():
    txt = open(JS, 'r', encoding='utf-8', newline='').read()
    a = txt.find('  /* 全站分层背景')
    if a < 0:
        a = txt.find('  /* 全站炫彩背景')
    b = txt.find('  /* 8. 剑意', a)
    if a < 0 or b < 0:
        print('ui.js: anchors not found', a, b)
        sys.exit(1)
    txt = txt[:a] + JS_BLOCK + txt[b:]
    open(JS, 'w', encoding='utf-8', newline='').write(txt)
    print('ui.js: fxBg() replaced, removed', b - a, 'chars')


if __name__ == '__main__':
    patch_css()
    patch_js()
