# -*- coding: utf-8 -*-
"""《奇迹MU-英雄连城》官网 yysolos.com「游戏特色」职业图 → 站点三件套。

源站：https://www.yysolos.com/  （官网首页 #featureCarousel 五张 1280x720）
整图等比缩放、不裁切，保留官网创建角色界面原画面与文字；可重复执行（缺图自动下载）。
"""
import os
import urllib.request

from PIL import Image
import pillow_avif  # noqa: F401  (注册 AVIF 编码器)

BASE = 'https://yysolos.com/zb_users/upload/2026/11/'
SRC = '_yys_src'
OUT = 'assets'

# base -> 官网文件名（顺序按官网轮播，展示顺序在 index.html 里另排）
FILES = {
    'yxlc-feat-mage':    '202611031793689245204745.png',   # 魔法师
    'yxlc-feat-archer':  '202611031793689254234692.png',   # 弓箭手
    'yxlc-feat-blade':   '202611031793689263783480.png',   # 魔剑士
    'yxlc-feat-saint':   '202611031793689272793096.png',   # 圣导师
    'yxlc-feat-warrior': '202611031793689285718911.jpg',   # 剑士
}
SLIDES = ('yxlc-feat-warrior', 'yxlc-feat-mage')


def local(name):
    return os.path.join(SRC, name)


def fetch_all():
    os.makedirs(SRC, exist_ok=True)
    for name in FILES.values():
        p = local(name)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            continue
        req = urllib.request.Request(BASE + name, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
            'Referer': 'https://www.yysolos.com/'
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(p, 'wb') as f:
            f.write(data)
        print('downloaded', name, len(data), 'bytes')


def save3(im, base, q_jpg=84, q_webp=82, q_avif=55):
    p = os.path.join(OUT, base)
    im.save(p + '.jpg', 'JPEG', quality=q_jpg, optimize=True, progressive=True)
    im.save(p + '.webp', 'WEBP', quality=q_webp, method=6)
    im.save(p + '.avif', 'AVIF', quality=q_avif, speed=6)
    sizes = ['%s:%dKB' % (e, os.path.getsize(p + e) // 1024)
             for e in ('.jpg', '.webp', '.avif')]
    print(' ', base, im.size, ' '.join(sizes))


def main():
    fetch_all()
    os.makedirs(OUT, exist_ok=True)
    for base, name in FILES.items():
        im = Image.open(local(name)).convert('RGB')
        w, h = im.size
        assert (w, h) == (1280, 720), (base, im.size)
        tw = 1264
        big = im.resize((tw, round(h * tw / w)), Image.LANCZOS)
        save3(big, base)
        if base in SLIDES:
            sw = 960
            save3(big.resize((sw, round(h * sw / w)), Image.LANCZOS), base + '_960w', q_avif=52)
    print('DONE')


if __name__ == '__main__':
    main()
