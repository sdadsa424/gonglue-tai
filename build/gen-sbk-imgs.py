# -*- coding: utf-8 -*-
"""《沙巴克传奇》官网 sbkcq.cn 宣传图 → 站点三件套（jpg/webp/avif）。

源图已抓到 _sbk_img/（img1 主视觉 1000×558，其余 965×539）；
只转格式不裁切不加字；hero 额外输出 _960w 变体供 game-card/轮播 srcset 使用。
可重复执行。
"""
import os
from PIL import Image
import pillow_avif  # noqa: F401

SRC = '_sbk_img'
OUT = 'assets'

FILES = {
    'sbk-hero':   'img1.jpg',        # 传奇 · 热血不灭 主视觉
    'sbk-feat-1': 'img5.jpg',        # 十年经典 再续传奇（正版IP）
    'sbk-feat-2': 'img3.jpg',        # 战火不灭 双职业沙城
    'sbk-feat-3': 'img6.jpg',        # 攻城战场面
    'sbk-shot-1': 'img4.jpg',        # 战士挥刀原画
}


def save3(im, base, q_jpg=84, q_webp=82, q_avif=55):
    p = os.path.join(OUT, base)
    im.save(p + '.jpg', 'JPEG', quality=q_jpg, optimize=True, progressive=True)
    im.save(p + '.webp', 'WEBP', quality=q_webp, method=6)
    im.save(p + '.avif', 'AVIF', quality=q_avif, speed=6)
    print(base, im.size, ' '.join('%s:%dKB' % (e, os.path.getsize(p + e) // 1024) for e in ('.jpg', '.webp', '.avif')))


for base, src in FILES.items():
    im = Image.open(os.path.join(SRC, src)).convert('RGB')
    save3(im, base)
    if base == 'sbk-hero':
        save3(im.resize((960, 536), Image.LANCZOS), base + '_960w', q_avif=52)

# 图标：官网二维码中央嵌入的游戏图标（已裁剪 176×176）
icon = Image.open(os.path.join(SRC, 'icon-crop.png')).convert('RGB')
save3(icon, 'sbk-icon', q_jpg=88, q_webp=86, q_avif=65)
print('DONE')
