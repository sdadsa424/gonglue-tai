# -*- coding: utf-8 -*-
"""用户提供的 10 张《传奇3D点卡版》新图 → 站点三件套。

首屏轮播 3 张：创建角色战士/法师/道士（cq3d-create-zs/fs/ds，原生 1125 宽 + 960w）；
图集 7 张：双战士主视觉、盟重摆摊、5 张玩法宣传图（原生宽，不上采样）。
可重复执行；源图路径写死在本机，仅供本次使用。
"""
import os

from PIL import Image
import pillow_avif  # noqa: F401  (注册 AVIF 编码器)

SRC = r'C:\Users\老王\Desktop\图片素材文件夹(1)\3D传奇'
CLIP = r'C:\Users\老王\.workbuddy\clipboard-images'
OUT = 'assets'
MAXW = 1264

# name -> 源图绝对路径
FILES = {
    'cq3d-create-zs':   os.path.join(CLIP, 'clipboard-2026-11-15T07-40-28-180Z-6f061b73.jpg'),
    'cq3d-create-fs':   os.path.join(CLIP, 'clipboard-2026-11-15T07-40-28-181Z-f6db84e4.jpg'),
    'cq3d-create-ds':   os.path.join(CLIP, 'clipboard-2026-11-15T07-40-28-183Z-af47c744.jpg'),
    'cq3d-key':         os.path.join(SRC, '202611061793949079447468.webp'),
    'cq3d-stall':       os.path.join(CLIP, 'clipboard-2026-11-15T07-40-28-178Z-5a431df0.jpg'),
    'cq3d-promo-trade': os.path.join(SRC, '202611061793932034280808.jpg'),
    'cq3d-promo-siege': os.path.join(SRC, '202611061793932041910167.jpg'),
    'cq3d-promo-sworn': os.path.join(SRC, '202611061793932048228564.jpg'),
    'cq3d-promo-team':  os.path.join(SRC, '202611061793932054833093.jpg'),
    'cq3d-promo-skill': os.path.join(SRC, '202611061793932061185635.jpg'),
}
SLIDES = ('cq3d-create-zs', 'cq3d-create-fs', 'cq3d-create-ds')


def save3(img, base, q_jpg=84, q_webp=82, q_avif=55):
    p = os.path.join(OUT, base)
    img.save(p + '.jpg', 'JPEG', quality=q_jpg, optimize=True, progressive=True)
    img.save(p + '.webp', 'WEBP', quality=q_webp, method=6)
    img.save(p + '.avif', 'AVIF', quality=q_avif, speed=6)
    print(' ', base, img.size, ' '.join('%s:%dKB' % (e, os.path.getsize(p + e) // 1024)
                                        for e in ('.jpg', '.webp', '.avif')))
    return img.size


def main():
    for base, path in FILES.items():
        im = Image.open(path).convert('RGB')
        w, h = im.size
        tw = min(w, MAXW)
        big = im.resize((tw, round(h * tw / w)), Image.LANCZOS) if tw != w else im
        size = save3(big, base)
        if base in SLIDES:
            sw = 960
            save3(im.resize((sw, round(h * sw / w)), Image.LANCZOS), base + '_960w',
                  q_jpg=80, q_webp=78, q_avif=52)


if __name__ == '__main__':
    main()
