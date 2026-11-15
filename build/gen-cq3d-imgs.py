# -*- coding: utf-8 -*-
"""《传奇3D点卡版》（义战龙城3D纯净版）官网 sqqyxz.com 截图 → 站点三件套。

源站图片经 Referer 下载到 _sq_img/（见抓取脚本），本脚本只做缩放与三格式输出；
整图等比缩放、不裁切，保留官网原始画面与界面文字；可重复执行（源图存在即跳过下载）。
"""
import os

from PIL import Image
import pillow_avif  # noqa: F401  (注册 AVIF 编码器)

SRC = '_sq_img'
OUT = 'assets'

# base -> 源图（顺序即展示顺序：class/mongjen/tomb 为首屏轮播）
CDN = 'https://nwzimg.wezhan.cn/contents/sitefiles2074/10374314/images/'
FILES = {
    'cq3d-class':   '62308013.png',   # 创建角色：战士 / 法师 / 道士三职业界面
    'cq3d-mongjen': '62308017.png',   # 盟重群战
    'cq3d-tomb':    '62308015.png',   # 石墓一层挂机自动战斗
    'cq3d-village': '62308012.png',   # 盟重村庄与掉落公告
    'cq3d-town':    '62308016.png',   # 盟重主城 NPC 群
    'cq3d-field':   '62308019.png',   # 野外战斗
}


def fetch_all():
    import urllib.request
    os.makedirs(SRC, exist_ok=True)
    for name in FILES.values():
        p = os.path.join(SRC, name)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            continue
        req = urllib.request.Request(CDN + name, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
            'Referer': 'https://www.sqqyxz.com/'
        })
        with urllib.request.urlopen(req, timeout=40) as r:
            data = r.read()
        with open(p, 'wb') as f:
            f.write(data)
        print('downloaded', name, len(data), 'bytes')
SLIDES = ('cq3d-class', 'cq3d-mongjen', 'cq3d-tomb')


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
    for base, name in FILES.items():
        im = Image.open(os.path.join(SRC, name)).convert('RGB')
        w, h = im.size
        tw = 1264
        big = im.resize((tw, round(h * tw / w)), Image.LANCZOS)
        save3(big, base)
        if base in SLIDES:
            sw = 960
            small = im.resize((sw, round(h * sw / w)), Image.LANCZOS)
            save3(small, base + '_960w', q_jpg=80, q_webp=78, q_avif=52)


if __name__ == '__main__':
    main()
