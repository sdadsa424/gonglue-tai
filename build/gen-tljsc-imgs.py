# -*- coding: utf-8 -*-
"""《屠龙决战沙城》官网 ruioa.com 宣传图 → 站点三件套（jpg/webp/avif）。

源图已抓到 _tljsc_img/（5 张 750×394 横图 + 165×165 图标）；
只转格式不裁切不加字。可重复执行。
"""
import os
from PIL import Image
import pillow_avif  # noqa: F401

SRC = '_tljsc_img'
OUT = 'assets'

FILES = {
    'tljsc-hero':   'hero.jpg',    # 再续经典传奇3 三职业主视觉（七大元素标语）
    'tljsc-feat-1': 'forge.jpg',   # 装备锻造 套装打造强力属性
    'tljsc-feat-2': 'boss.jpg',    # 激战BOSS 经典地图激情无限
    'tljsc-feat-3': 'trade.jpg',   # 自由交易 无绑爆装散人天堂
    'tljsc-shot-1': 'afk.jpg',     # 秘境挂机 高额经验暴爽割草
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

# 图标：官网 165×165「传奇3 光通版」应用图标
icon = Image.open(os.path.join(SRC, 'icon.png')).convert('RGB')
save3(icon, 'tljsc-icon', q_jpg=88, q_webp=86, q_avif=65)
print('DONE')
