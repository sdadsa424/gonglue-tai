# -*- coding: utf-8 -*-
"""《GTA6》官方攻略页 gta6.talkn.cn 配图 → 站点三件套（jpg/webp/avif）。

源图已抓到 _gta6_img/（15 篇攻略头图 1200~1600 宽 + og-cover 1200×630 + 180×180 图标）。
只转格式不裁切不加字。可重复执行。
"""
import os
from PIL import Image
import pillow_avif  # noqa: F401

SRC = '_gta6_img'
OUT = 'assets'

FILES = {
    'gta6-hero': 'og-cover.png',
    'gta6-weather': 'ps5-cache-weather.jpg',
    'gta6-sellcar': 'steal-car-sell-money.jpg',
    'gta6-loot': 'loot-spot.png',
    'gta6-switch': 'switch-character.jpg',
    'gta6-motion': 'motion-sickness.jpg',
    'gta6-thrax': 'thrax-fastest-car.jpg',
    'gta6-focus': 'focus-mode.jpg',
    'gta6-bobcat': 'bobcat-key-stash.jpg',
    'gta6-secrets': 'secrets-sidequests.jpg',
    'gta6-porsche': 'pink-porsche.png',
    'gta6-glitch': 'money-glitch-warehouse.jpg',
    'gta6-60fps': 'xbox-60fps.jpg',
    'gta6-taxi': 'money-taxi-warehouse.jpg',
    'gta6-armor': 'bulletproof-tires.jpg',
    'gta6-map': 'map-controls.jpg',
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

icon = Image.open(os.path.join(SRC, 'apple-icon.png')).convert('RGB')
save3(icon, 'gta6-icon', q_jpg=88, q_webp=86, q_avif=65)
print('DONE')
