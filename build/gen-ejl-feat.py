# -*- coding: utf-8 -*-
"""《贰点零江湖》官网「游戏特色」图 → 站点三件套（jpg/webp/avif）。

源站：https://2.0.hyyx39.com/
整图等比缩放、不裁切，保留官网原画面与宣传文字；可重复执行（缺图时自动下载）。
"""
import os
import urllib.request

from PIL import Image
import pillow_avif  # noqa: F401  (注册 AVIF 编码器)

BASE = 'https://2.0.hyyx39.com'
SRC = '_hyimgs'
OUT = 'assets'

# base -> 官网相对路径（前 3 张来自「游戏特色」轮播，后 2 张为特色/主视觉宣传图）
FILES = {
    'ejl-feat-boss':    '/uploads/allimg/20260831/1-260S1191030326.jpg',
    'ejl-feat-pet':     '/uploads/allimg/20260831/1-260S119102LV.jpg',
    'ejl-feat-qi':      '/uploads/allimg/20260831/1-260S1191023327.jpg',
    'ejl-feat-classic': '/uploads/allimg/20260831/1-260S11ZZ61K.jpg',
    'ejl-feat-poster':  '/uploads/allimg/20260831/1-260S11Z913592.jpg',
}
SLIDES = ('ejl-feat-boss', 'ejl-feat-pet', 'ejl-feat-qi')


def local(rel):
    return os.path.join(SRC, os.path.basename(rel))


def fetch_all():
    os.makedirs(SRC, exist_ok=True)
    for base, rel in FILES.items():
        p = local(rel)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            continue
        req = urllib.request.Request(BASE + rel, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
            'Referer': BASE + '/'
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(p, 'wb') as f:
            f.write(data)
        print('downloaded', base, len(data), 'bytes')


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
    for base, rel in FILES.items():
        im = Image.open(local(rel)).convert('RGB')
        w, h = im.size
        tw = 1264
        big = im.resize((tw, round(h * tw / w)), Image.LANCZOS)
        save3(big, base)
        if base in SLIDES:
            sw = 960
            save3(big.resize((sw, round(h * sw / w)), Image.LANCZOS), base + '_960w', q_avif=52)
    print('DONE')


if __name__ == '__main__':
    main()
