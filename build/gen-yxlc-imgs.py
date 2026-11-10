# -*- coding: utf-8 -*-
"""英雄连城（yxnd328.com 抓取素材）→ 站点三件套（jpg/webp/avif）

源图（/tmp/yximg，Windows: C:/Users/老王/AppData/Local/Temp/yximg）：
  i5.png  2048x1152 经典还原场景图（三职业+翅膀） → hero 横版 + 竖版 poster 裁切
  i7.jpeg 859x477  奇迹转生巅峰对决海报          → 分站轮播 slide 2 / 图集
  i9.png  1600x900 经典回归加载页（弓手立绘）    → 分站轮播 slide 3 / 图集
  i2.jpg  2048x1216 茅台转盘活动界面             → 图集（活动展示）
  i3.jpg  512x512  MU 徽标                       → 图集
"""
from PIL import Image
import os

SRC = r'C:/Users/老王/AppData/Local/Temp/yximg'
OUT = 'assets'
os.makedirs(OUT, exist_ok=True)

try:
    import pillow_avif  # noqa: F401
    HAS_AVIF = True
except ImportError:
    HAS_AVIF = False
print('avif support:', HAS_AVIF)


def save3(im, base, q_jpg=84, q_webp=82, q_avif=55):
    p = os.path.join(OUT, base)
    im.save(p + '.jpg', 'JPEG', quality=q_jpg, optimize=True, progressive=True)
    im.save(p + '.webp', 'WEBP', quality=q_webp, method=6)
    if HAS_AVIF:
        im.save(p + '.avif', 'AVIF', quality=q_avif, speed=6)
    sizes = []
    for ext in ('.jpg', '.webp', '.avif'):
        f = p + ext
        if os.path.exists(f):
            sizes.append('%s:%dKB' % (ext, os.path.getsize(f) // 1024))
    print(base, im.size, ' '.join(sizes))


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


scene = load('i5.png')      # 2048x1152
war = load('i7.jpeg')       # 859x477
loadscr = load('i9.png')    # 1600x900
wheel = load('i2.jpg')      # 2048x1216
logo = load('i3.jpg')       # 512x512

# ---------- hero 横版 1264x711 + 960w：场景图本身 16:9，整图缩放 ----------
hero = scene.resize((1264, 711), Image.LANCZOS)
save3(hero, 'yxlc-hero', q_avif=52)
save3(hero.resize((960, 540), Image.LANCZOS), 'yxlc-hero_960w', q_avif=52)

# ---------- 竖版 poster 750x1000 + 480w：取场景图左侧三职业角色区 ----------
w, h = scene.size                      # 2048x1152
pw = int(h * 3 / 4)                    # 864
x0 = 40                                # 角色群偏左，稍微留出仙踪林边缘
poster = scene.crop((x0, 0, x0 + pw, h)).resize((750, 1000), Image.LANCZOS)
save3(poster, 'hero-yxlc', q_avif=52)
save3(poster.resize((480, 640), Image.LANCZOS), 'hero-yxlc_480w', q_avif=52)

# ---------- 分站轮播 slides 1264x711 + 960w ----------
s_war = war.resize((1264, 711), Image.LANCZOS)      # 859x477 ≈ 1.80 → 16:9 轻微裁上下
save3(s_war, 'yxlc-slide-war', q_avif=52)
save3(s_war.resize((960, 540), Image.LANCZOS), 'yxlc-slide-war_960w', q_avif=52)
s_ret = loadscr.resize((1264, 711), Image.LANCZOS)  # 1600x900 = 16:9
save3(s_ret, 'yxlc-slide-return', q_avif=52)
save3(s_ret.resize((960, 540), Image.LANCZOS), 'yxlc-slide-return_960w', q_avif=52)

# ---------- 图集（保持原比例，限宽 1600） ----------
gal1 = scene.resize((1600, 900), Image.LANCZOS)
save3(gal1, 'yxlc-art-scene', q_avif=55)

wh, ww = wheel.size                   # 2048x1216
gal2 = wheel.crop((0, (wh - int(ww * 9 / 16)) // 2, ww, (wh + int(ww * 9 / 16)) // 2)).resize((1600, 900), Image.LANCZOS)
save3(gal2, 'yxlc-event-wheel', q_avif=55)

save3(war, 'yxlc-poster-war', q_jpg=86, q_webp=84, q_avif=58)
save3(loadscr, 'yxlc-ss-loading', q_avif=55)
save3(logo, 'yxlc-logo', q_jpg=88, q_webp=86, q_avif=62)

print('DONE')
