# -*- coding: utf-8 -*-
"""《永恒岛之彩虹世界》官网 chd.7long.com 宣传图 → 站点三件套。

源图（swiper_1~5.png，836×444 横版官方宣传图，含官方文案）已抓到 _chd_img/；
本脚本只做格式输出，不裁切、不加字，保留官网原始画面与文字；
不放大超过原图宽度，避免糊图（hero 与 feat 均按 836 宽输出）。
可重复执行（源图存在即跳过下载）。
"""
import os
import urllib.request

from PIL import Image
import pillow_avif  # noqa: F401  注册 AVIF 编码器

SRC = '_chd_img'
OUT = 'assets'
CDN = 'https://chd.7long.com/public/chd/index/images/'

# base -> (源文件, 用途)
FILES = {
    'chd-hero':   'swiper_1.png',   # 爱丽丝回归 · 首屏主视觉
    'chd-feat-1': 'swiper_2.png',   # 四大职业
    'chd-feat-2': 'swiper_3.png',   # 百变打扮
    'chd-feat-3': 'swiper_4.png',   # 组队开荒
    'chd-feat-4': 'swiper_5.png',   # 社交彩虹
}
ICON_SRC = 'https://chd.7long.com/public/chd/img/icon.ico'


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Referer': 'https://chd.7long.com/'
    })
    with urllib.request.urlopen(req, timeout=40) as r:
        data = r.read()
    with open(path, 'wb') as f:
        f.write(data)
    print('downloaded', path, len(data), 'bytes')


def save3(im, base, q_jpg=84, q_webp=82, q_avif=55):
    p = os.path.join(OUT, base)
    im.save(p + '.jpg', 'JPEG', quality=q_jpg, optimize=True, progressive=True)
    im.save(p + '.webp', 'WEBP', quality=q_webp, method=6)
    im.save(p + '.avif', 'AVIF', quality=q_avif, speed=6)
    sizes = ['%s:%dKB' % (e, os.path.getsize(p + e) // 1024)
             for e in ('.jpg', '.webp', '.avif')]
    print(' ', base, im.size, ' '.join(sizes))


def main():
    os.makedirs(SRC, exist_ok=True)
    for base, name in FILES.items():
        fetch(CDN + name, os.path.join(SRC, name))
        im = Image.open(os.path.join(SRC, name)).convert('RGB')
        save3(im, base, q_jpg=86, q_webp=84, q_avif=58)

    # 图标：icon.ico 256×256 → 512 画布居中（与其他游戏 icon 一致的 512×512 方图）
    ip = os.path.join(SRC, 'icon.ico')
    fetch(ICON_SRC, ip)
    ic = Image.open(ip).convert('RGBA')
    ic = ic.resize((512, 512), Image.LANCZOS)
    bg = Image.new('RGB', (512, 512), (18, 20, 26))
    bg.paste(ic, (0, 0), ic)
    save3(bg, 'chd-icon', q_jpg=90, q_webp=88, q_avif=62)


if __name__ == '__main__':
    main()
