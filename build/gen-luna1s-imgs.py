# -*- coding: utf-8 -*-
"""luna1s.cn 官网抓取图 → 站点三件套（jpg/webp/avif）
源：官网轮播/壁纸区，与官方素材包 ts1~ts5 重复的已剔除，只处理新增 3 张
"""
from PIL import Image
import os

SRC = os.environ.get('TEMP', '/tmp') + '/luna1s'
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


PAIRS = [
    # (源文件, 输出名, 最大宽, avif 质量)
    ('20251117irkupb.jpg', 'luna2-art-village', 1600, 52),  # 无字原画 · 萌系村庄
    ('20251117yrpspc.jpg', 'luna2-ss-dress',    1600, 55),  # 实机 · 时装与特效
    ('20251211zggmcz.png', 'luna2-classic',     1019, 55),  # 经典壁纸 · LUNA ONLINE
]
for src, base, maxw, qa in PAIRS:
    im = load(src)
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)
    save3(im, base, q_avif=qa)

print('DONE')
