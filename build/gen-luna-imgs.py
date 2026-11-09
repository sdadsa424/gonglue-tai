# -*- coding: utf-8 -*-
"""露娜2 素材图 → 站点三件套（jpg/webp/avif）"""
from PIL import Image, ImageFilter
import os

SRC = r'C:/Users/老王/Desktop/图片素材文件夹(1)/露娜端游素材(1)/露娜端游素材'
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


def load(rel):
    return Image.open(os.path.join(SRC, rel)).convert('RGB')


# ---------- hero：ts2 自由转职（1334x750 横版） ----------
ts2 = load('ts2.jpg')

# 横版 1264x628 + 960w：取中上部（人物主体通常在中上）
def crop_box(im, tw, th, focus_y=0.42):
    w, h = im.size
    r = tw / th
    if w / h > r:  # 太宽，裁左右
        nw = int(h * r)
        x0 = (w - nw) // 2
        box = (x0, 0, x0 + nw, h)
    else:          # 太高，按 focus_y 取上偏
        nh = int(w / r)
        y0 = max(0, min(h - nh, int(h * focus_y - nh / 2)))
        box = (0, y0, w, y0 + nh)
    return im.crop(box)

wide = crop_box(ts2, 1264, 628).resize((1264, 628), Image.LANCZOS)
save3(wide, 'luna2-hero', q_avif=52)
wide960 = wide.resize((960, 477), Image.LANCZOS)
save3(wide960, 'luna2-hero_960w', q_avif=52)

# 竖版 750x1000 + 480w：从横图中央裁 2:3 竖条（500x750）再放大 1.5x
tall_src = crop_box(ts2, 500, 750, focus_y=0.30)
tall = tall_src.resize((750, 1000), Image.LANCZOS)
tall = tall.filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
save3(tall, 'hero-luna2', q_avif=52)
tall480 = tall.resize((480, 640), Image.LANCZOS)
save3(tall480, 'hero-luna2_480w', q_avif=52)

# ---------- 攻略配图：保持原尺寸（<=1014 宽），仅转格式 ----------
PAIRS = [
    ('魔附/ScreenShot_2025-11-05_155251_960.png', 'luna2-mofu-ui'),
    ('魔附/ScreenShot_2025-11-05_155322_231.png', 'luna2-mofu-mat'),
    ('魔附/ScreenShot_2025-11-05_160016_730.png', 'luna2-mofu-table'),
    ('摆摊/购入商店.png',                          'luna2-stall-open'),
    ('摆摊/贩卖.png',                              'luna2-stall-sell'),
    ('挂机辅助/ScreenShot_2025-11-09_190311_823.png', 'luna2-auto-panel'),
    ('1转技能加点/法师/ScreenShot_2025-11-15_143931_712.png', 'luna2-skill-mage'),
    ('1转技能加点/法师/修士/ScreenShot_2025-11-20_150247_232.png', 'luna2-skill-monk'),
    ('被动技能.png',                               'luna2-skill-passive'),
    ('法师修士2转/2转技能/ScreenShot_2025-11-23_192811_473.png', 'luna2-skill-t2'),
]
for rel, base in PAIRS:
    im = load(rel)
    if im.width > 1014:
        im = im.resize((1014, int(im.height * 1014 / im.width)), Image.LANCZOS)
    save3(im, base, q_avif=58)

print('DONE')
