// 临时工具：真实首页 #latest 两侧注入三种动画并截图（不修改 index.html）
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const FX = {
  a: `
  .fxb{position:absolute;top:0;height:100%;overflow:hidden;z-index:4;pointer-events:none;background:rgba(12,14,18,.35)}
  .fxb .slash{position:absolute;left:-10%;width:120%;height:6px;border-radius:3px;opacity:0;transform:rotate(-34deg)}
  .fxb .s1{top:22%;background:#FAC775;animation:fsl 2.8s ease-out infinite}
  .fxb .s2{top:44%;background:#B5D4F4;animation:fsl 2.8s ease-out -1.4s infinite}
  .fxb .s3{top:66%;background:#FAC775;height:4px;animation:fsl 2.8s ease-out -.9s infinite}
  .fxb .s4{top:84%;background:#ED93B1;height:4px;animation:fsl 2.8s ease-out -2.1s infinite}
  @keyframes fsl{0%,50%{opacity:0;transform:rotate(-34deg) scaleX(.5)}56%{opacity:.95;transform:rotate(-34deg) scaleX(1)}68%{opacity:.7}76%,100%{opacity:0;transform:rotate(-34deg) scaleX(1.15)}}
  .fxb .spk{position:absolute;width:5px;height:5px;border-radius:50%;background:#FAC775;opacity:0;animation:fsk 2.8s steps(1,end) infinite}
  .fxb .spk.b{background:#B5D4F4;animation-delay:-1.4s}
  @keyframes fsk{0%,52%{opacity:0}56%,70%{opacity:.9}78%,100%{opacity:0}}
  .fxb .corner{position:absolute;width:18px;height:18px;border:2px solid rgba(95,225,203,.35)}
  .fxb .c1{top:14px;left:14px;border-right:0;border-bottom:0}
  .fxb .c2{top:14px;right:14px;border-left:0;border-bottom:0}
  .fxb .c3{bottom:14px;left:14px;border-right:0;border-top:0}
  .fxb .c4{bottom:14px;right:14px;border-left:0;border-top:0}`,
  b: `
  .fxb{position:absolute;top:0;height:100%;overflow:hidden;z-index:4;pointer-events:none;background:rgba(10,13,18,.4)}
  .fxb svg{position:absolute;inset:0;width:100%;height:100%}
  .fxb .tr{stroke:#185FA5;stroke-width:1.6;fill:none}
  .fxb .nd{fill:#5DCAA5}
  .fxb .dot{width:7px;height:7px;border-radius:2px;background:#9FE1CB;position:absolute;box-shadow:0 0 6px #9FE1CB;animation:fpulse 2.4s linear infinite}
  .fxb .d2{background:#FAC775;box-shadow:0 0 6px #FAC775;animation-duration:3.1s;animation-delay:-1.2s}
  .fxb .d3{background:#B5D4F4;box-shadow:0 0 6px #B5D4F4;animation-duration:2.8s;animation-delay:-.6s}
  @keyframes fpulse{from{transform:translate(0,0);opacity:1}90%{opacity:1}to{transform:translate(var(--dx),var(--dy));opacity:0}}
  .fxb .corner{position:absolute;width:18px;height:18px;border:2px solid rgba(95,225,203,.35)}
  .fxb .c1{top:14px;left:14px;border-right:0;border-bottom:0}
  .fxb .c2{top:14px;right:14px;border-left:0;border-bottom:0}
  .fxb .c3{bottom:14px;left:14px;border-right:0;border-top:0}
  .fxb .c4{bottom:14px;right:14px;border-left:0;border-top:0}`,
  c: `
  .fxb{position:absolute;top:0;height:100%;overflow:hidden;z-index:4;pointer-events:none;background:rgba(11,13,17,.4)}
  .fxb .px{position:absolute;top:-20px;opacity:0;animation:frise 6s linear infinite}
  @keyframes frise{0%{opacity:0;transform:translateY(0) rotate(0)}8%{opacity:.85}80%{opacity:.5}100%{opacity:0;transform:translateY(360px) rotate(160deg)}}
  .fxb .corner{position:absolute;width:18px;height:18px;border:2px solid rgba(95,225,203,.35)}
  .fxb .c1{top:14px;left:14px;border-right:0;border-bottom:0}
  .fxb .c2{top:14px;right:14px;border-left:0;border-bottom:0}
  .fxb .c3{bottom:14px;left:14px;border-right:0;border-top:0}
  .fxb .c4{bottom:14px;right:14px;border-left:0;border-top:0}`
};

const DOM = {
  a: `<div class="fxb fl"><i class="slash s1"></i><i class="slash s2"></i><i class="slash s3"></i><i class="slash s4"></i>
    <i class="spk" style="top:18%;left:30%"></i><i class="spk" style="top:38%;left:60%"></i><i class="spk b" style="top:52%;left:25%"></i><i class="spk b" style="top:70%;left:65%"></i>
    <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i></div>
    <div class="fxb fr"><i class="slash s1"></i><i class="slash s2"></i><i class="slash s3"></i><i class="slash s4"></i>
    <i class="spk" style="top:24%;left:55%"></i><i class="spk" style="top:46%;left:20%"></i><i class="spk b" style="top:60%;left:70%"></i><i class="spk b" style="top:80%;left:35%"></i>
    <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i></div>`,
  b: `<div class="fxb fl"><svg viewBox="0 0 200 600" preserveAspectRatio="none">
    <path class="tr" d="M20,60 H120 L160,100 H200"/><path class="tr" d="M0,180 H90 L130,140 H200"/>
    <path class="tr" d="M30,320 H110 L150,280 H200"/><path class="tr" d="M0,430 H80 L120,470 H200"/>
    <path class="tr" d="M40,540 H130 L170,500 H200"/></svg>
    <svg class="fr-only" style="display:none"></svg>
    <i class="dot" style="top:8.8%;left:10%;--dx:150px;--dy:35px"></i>
    <i class="dot d2" style="top:28%;left:0%;--dx:170px;--dy:-35px"></i>
    <i class="dot d3" style="top:51%;left:15%;--dx:150px;--dy:-35px"></i>
    <i class="dot d2" style="top:69.6%;left:0%;--dx:170px;--dy:35px"></i>
    <i class="dot" style="top:88%;left:20%;--dx:150px;--dy:-35px"></i>
    <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i></div>
    <div class="fxb fr"><svg viewBox="0 0 200 600" preserveAspectRatio="none">
    <path class="tr" d="M180,60 H80 L40,100 H0"/><path class="tr" d="M200,180 H110 L70,140 H0"/>
    <path class="tr" d="M170,320 H90 L50,280 H0"/><path class="tr" d="M200,430 H120 L80,470 H0"/>
    <path class="tr" d="M160,540 H70 L30,500 H0"/></svg>
    <i class="dot" style="top:8.8%;right:10%;--dx:-150px;--dy:35px"></i>
    <i class="dot d2" style="top:28%;right:0%;--dx:-170px;--dy:-35px"></i>
    <i class="dot d3" style="top:51%;right:15%;--dx:-150px;--dy:-35px"></i>
    <i class="dot d2" style="top:69.6%;right:0%;--dx:-170px;--dy:35px"></i>
    <i class="dot" style="top:88%;right:20%;--dx:-150px;--dy:-35px"></i>
    <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i></div>`,
  c: `<div class="fxb fl">
    ${[['14%','#FAC775',20,0],['26%','#5DCAA5',14,-1.6],['42%','#B5D4F4',18,-3.2],['56%','#FAC775',15,-.9],['68%','#ED93B1',17,-4.4],['80%','#5DCAA5',14,-2.3]]
      .map((p,i)=>`<i class="px" style="left:${p[0]};width:${p[2]}px;height:${p[2]}px;background:${p[1]};animation-delay:${p[3]}s;animation-duration:${5.2+(i%3)*1.1}s"></i>`).join('')}
    <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i></div>
    <div class="fxb fr">
    ${[['12%','#B5D4F4',17,-.8],['30%','#FAC775',19,-2.5],['46%','#5DCAA5',14,-4],['58%','#F4C0D1',16,-1.9],['72%','#FAC775',15,-3.6],['84%','#5DCAA5',18,-.4]]
      .map((p,i)=>`<i class="px" style="left:${p[0]};width:${p[2]}px;height:${p[2]}px;background:${p[1]};animation-delay:${p[3]}s;animation-duration:${5.2+(i%3)*1.1}s"></i>`).join('')}
    <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i></div>`
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--window-size=1760,1700'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1760, height: 1700, deviceScaleFactor: 1 });
  await page.goto('http://localhost:8766/', { waitUntil: 'networkidle2', timeout: 30000 });

  const rect = await page.evaluate(() => {
    const sec = document.querySelector('#latest');
    const wrap = sec.querySelector('.fc') || sec.querySelector('.wrap') || sec;
    const sr = sec.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    return { top: sr.top + scrollY, h: sr.height, wl: wr.left, wR: wr.right, vw: innerWidth };
  });
  const bw = rect.wl; // 左侧带宽 = 右侧带宽
  const vh = rect.h;

  for (const k of ['a', 'b', 'c']) {
    await page.evaluate(({ css, dom, rect, bw }) => {
      document.querySelectorAll('.fxb').forEach(e => e.remove());
      let st = document.getElementById('fxstyle');
      if (!st) { st = document.createElement('style'); st.id = 'fxstyle'; document.head.appendChild(st); }
      st.textContent = css;
      const sec = document.querySelector('#latest');
      const holder = document.createElement('div');
      holder.style.cssText = `position:absolute;left:0;top:${rect.top}px;width:${rect.vw}px;height:${rect.h}px;pointer-events:none;z-index:3`;
      holder.innerHTML = dom;
      holder.querySelectorAll('.fl').forEach(e => { e.style.left = '0'; e.style.width = bw + 'px'; });
      holder.querySelectorAll('.fr').forEach(e => { e.style.left = rect.wR + 'px'; e.style.width = (rect.vw - rect.wR) + 'px'; });
      document.body.appendChild(holder);
      holder.dataset.fx = '1';
    }, { css: FX[k], dom: DOM[k], rect, bw });

    await new Promise(r => setTimeout(r, 1600));
    await page.evaluate(() => { document.getAnimations().forEach(a => { if (a.animationName && String(a.animationName).startsWith('f')) { a.currentTime = 1700; a.pause(); } }); });
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: `_fx-${k}.png`, clip: { x: 0, y: 0, width: rect.vw, height: vh }, fullPage: false });
    // clip 需要视口内坐标：先滚到区块
    await page.evaluate(top => scrollTo(0, top - 20), rect.top);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `_fx-${k}.png`, clip: { x: 0, y: 20, width: rect.vw, height: vh } });
    console.log(`_fx-${k}.png done`);
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
