# -*- coding: utf-8 -*-
"""《小小屠龙·冰雪传奇》官网「游戏特色」5 张图 → 站点三件套（jpg/webp/avif）。

源站：https://fgbx.huanyu-inc.com/default/index
官网 WAP「游戏特色」轮播 5 张均为 718x537（4:3），PC 版 test1~5 除第 1 张外完全相同；
WAP 第 1 张含完整副标题「1:1 复刻端游」，故统一取 WAP 版。

产出两套：
  * xxtl-feat-*      4:3 原图，等比缩放，用于「游戏特色 · 官方图集」（完整、不裁切、不变形）
  * xxtl-hero-*      16:9，用于分站 hero 轮播。4:3 原图直接 cover 会裁掉上下文字，
                     故用「拉伸后强模糊作底 + 完整原图居中 + 羽化过渡」延展，
                     主体画面与标题 100% 保留，左右补的是模糊雪景，不做镜像（镜像会重复标题文字）。
  * xxtl-hero-*_960w hero 图的窄屏变体。

可重复执行：缺源图时自动下载（带 UA / Referer）。
"""
import os
import urllib.request

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import pillow_avif  # noqa: F401  (注册 AVIF 编码器)

BASE = 'https://fgbx.huanyu-inc.com'
SRC = '_fgimgs'
OUT = 'assets'

# base -> 官网 WAP 相对路径（按官网特色展示 01~05 顺序）
FILES = {
    'ice':   '/public/fgbx/wap/img/feature_pic1.jpg',   # 冰雪复古单职业 · 1:1 复刻端游
    'skill': '/public/fgbx/wap/img/feature_pic2.jpg',   # 技能混搭 · 刀刀极品 装备全靠打
    'gold':  '/public/fgbx/wap/img/feature_pic3.jpg',   # 散人打金 · 自由交易 元宝回收
    'idle':  '/public/fgbx/wap/img/feature_pic4.jpg',   # 泡点挂机 · 轻松升级 即刻开战
    'siege': '/public/fgbx/wap/img/feature_pic5.jpg',   # 巅峰对决 · 经典攻沙 至高荣誉
}
# hero 轮播用：主视觉 + 打宝 + 攻沙，与分站开荒路线文案呼应
HERO = ('ice', 'gold', 'siege')


def local(rel):
    return os.path.join(SRC, os.path.basename(rel))


def fetch_all():
    os.makedirs(SRC, exist_ok=True)
    for rel in FILES.values():
        p = local(rel)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            continue
        req = urllib.request.Request(BASE + rel, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
            'Referer': BASE + '/default/index'
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(p, 'wb') as f:
            f.write(data)
        print('downloaded', os.path.basename(p), len(data), 'bytes')


def save3(im, base, q_jpg=85, q_webp=82, q_avif=55):
    p = os.path.join(OUT, base)
    im.save(p + '.jpg', 'JPEG', quality=q_jpg, optimize=True, progressive=True)
    im.save(p + '.webp', 'WEBP', quality=q_webp, method=6)
    im.save(p + '.avif', 'AVIF', quality=q_avif, speed=6)
    sizes = ['%s:%dKB' % (e, os.path.getsize(p + e) // 1024)
             for e in ('.jpg', '.webp', '.avif')]
    print(' ', base, im.size, ' '.join(sizes))


def wide16x9(im):
    """4:3 → 16:9：模糊底 + 完整原图居中 + 左右羽化，主体零裁切。"""
    w, h = im.size
    tw = round(h * 16 / 9)
    pad = (tw - w) // 2
    bg = ImageEnhance.Brightness(
        im.resize((tw, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(30))
    ).enhance(.78)
    out = bg.copy()
    out.paste(im, (pad, 0))
    mask = Image.new('L', (tw, h), 0)
    d = ImageDraw.Draw(mask)
    d.rectangle((pad, 0, pad + w, h), fill=255)
    feather = 30
    for x in range(feather):
        a = round(255 * x / feather)
        d.line((pad - feather + x, 0, pad - feather + x, h), fill=a)
        d.line((pad + w + feather - 1 - x, 0, pad + w + feather - 1 - x, h), fill=a)
    return Image.composite(out, bg, mask)


def main():
    fetch_all()
    os.makedirs(OUT, exist_ok=True)
    ims = {k: Image.open(local(rel)).convert('RGB') for k, rel in FILES.items()}

    # 1) 图集：4:3 原图等比放大到 1264 宽（1264 x 945）
    for key, im in ims.items():
        w, h = im.size
        big = im.resize((1264, round(h * 1264 / w)), Image.LANCZOS)
        save3(big, 'xxtl-feat-' + key)

    # 2) hero：16:9 延展图 1264 宽（1264 x 711）+ 960w 变体
    for key in HERO:
        wide = wide16x9(ims[key])
        w, h = wide.size
        big = wide.resize((1264, round(h * 1264 / w)), Image.LANCZOS)
        save3(big, 'xxtl-hero-' + key)
        save3(big.resize((960, round(h * 960 / w)), Image.LANCZOS),
              'xxtl-hero-' + key + '_960w', q_avif=52)
    print('DONE')


if __name__ == '__main__':
    main()
