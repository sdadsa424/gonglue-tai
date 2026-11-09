# -*- coding: utf-8 -*-
import io

# ============ build.mjs ============
p = 'build/build.mjs'
s = io.open(p, encoding='utf-8').read().replace('\r\n', '\n')

def repb(old, new):
    global s
    assert old in s, 'build missing: ' + old[:70]
    s = s.replace(old, new, 1)

repb("const ORDER = ['ejl', 'xxtl', 'ty'];", "const ORDER = ['ejl', 'xxtl', 'ty', 'luna2'];")
repb("const HERO = { ejl: 'assets/hero-ejl.jpg', xxtl: 'assets/hero-xxtl.jpg', ty: 'assets/hero-ty.jpg' };",
     "const HERO = { ejl: 'assets/hero-ejl.jpg', xxtl: 'assets/hero-xxtl.jpg', ty: 'assets/hero-ty.jpg', luna2: 'assets/luna2-hero.jpg' };")
repb("const GAME_IMG = { ejl: 'assets/ejl-hero.jpg', xxtl: 'assets/xxtl-siege.jpg', ty: 'assets/ty-key.jpg' };",
     "const GAME_IMG = { ejl: 'assets/ejl-hero.jpg', xxtl: 'assets/xxtl-siege.jpg', ty: 'assets/ty-key.jpg', luna2: 'assets/luna2-hero.jpg' };")

# 删 LAUNCH 常量块（注释 + 定义）
i1 = s.index('};', s.index('const LAUNCH = {')) + len('};\n')
i0 = s.rindex('/*', 0, s.index('const LAUNCH = {'))
s = s[:i0] + s[i1:]

# 删 lunaPage 整段
i0 = s.index('/* ---------- 公测预热页 /g/luna2/ ----------')
ip = s.index('files.push(lunaPage());')
s = s[:i0] + 'ORDER.forEach(k => files.push(gamePage(k)));\n' + s[ip + len('files.push(lunaPage());'):].lstrip('\n')

# 删 sitemap 的 luna2 特殊行
i0 = s.index('  <url><loc>${SITE}g/${LAUNCH.id}/</loc>')
i1 = s.index('\n', i0) + 1
s = s[:i0] + s[i1:]

assert 'LAUNCH' not in s and 'lunaPage' not in s
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('build.mjs ok')

# ============ ui.js：掉落池 ============
p = 'assets/ui.js'
s = io.open(p, encoding='utf-8').read().replace('\r\n', '\n')

old_key = "    var key = /^ejl-/.test(aid) ? 'ejl' : /^xxtl-/.test(aid) ? 'xxtl' : 'ty';"
new_key = "    var key = /^ejl-/.test(aid) ? 'ejl' : /^luna2-/.test(aid) ? 'luna2' : /^xxtl-/.test(aid) ? 'xxtl' : 'ty';"
assert old_key in s
s = s.replace(old_key, new_key, 1)

pool_anchor = "      ty: ["
luna_pool = """      luna2: [
        ['魔附宝石', '魔附材料 · 攒满 10 个再开点', 1], ['鹅卵石', '魔附材料 · 盔甲 · 体力', 1],
        ['红宝石', '魔附材料 · 力量', 1], ['绿宝石', '魔附材料 · 敏捷', 1],
        ['月光石', '魔附材料 · 魔法攻击力', 2], ['磷矿石', '魔附材料 · 暴击率', 2],
        ['哈鲁根原石', '魔附材料 · 物理攻击力', 2], ['蓝晶石', '魔附材料 · 智力', 2],
        ['心型石', '魔附材料 · 最大血量', 3], ['风之水晶', '魔附材料 · 回避', 3],
        ['妖精的翅膀', '魔附材料 · 移动速度', 3], ['特制采矿镐', '采集矿物标本的必备工具', 3],
        ['生命之石', '魔附材料 · 生命回复', 4], ['精神之石', '魔附材料 · 魔法回复', 4],
        ['黄之水晶', '魔附材料 · 命中', 4], ['银晶石', '魔附材料 · 双防 · 市面少见', 4],
        ['奥里哈鲁根原石', '最珍贵的魔附材料 · 物攻大幅提升', 5]
      ],
      ty: ["""
assert pool_anchor in s
s = s.replace(pool_anchor, luna_pool, 1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ui.js ok')

# ============ style.css ============
p = 'assets/style.css'
b = io.open(p, 'rb').read()
s = b.decode('utf-8').replace('\r\n', '\n')

# 删 game-soon 横幅样式段
i0 = s.index('/* ============ 公测预告：首页通栏横幅 ============ */')
i1 = s.index('/* 倒计时单位：横幅与分站页共用 */')
s = s[:i0] + s[i1:]
s = s.replace('/* 倒计时单位：横幅与分站页共用 */', '/* 倒计时单位：分站 hero 用 */')

# 删 luna 分站旧样式段（luna-hero 到 .luna-foot 结尾）
i0 = s.index('/* ============ 公测预热分站 /g/luna2/ ============ */')
i1 = s.index('.luna-foot{font-size:11px')
i2 = s.index('\n', s.index('}', i1))
s = s[:i0] + s[i2 + 1:]

# vote 4 列
s = s.replace('.vote-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}',
              '.vote-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}')
s = s.replace('  .vote-row{grid-template-columns:1fr;gap:9px}',
              '  .vote-row{grid-template-columns:1fr;gap:9px}\n@media (max-width:1080px) and (min-width:761px){.vote-row{grid-template-columns:repeat(2,minmax(0,1fr))}}')

# hero 倒计时 + 资质说明样式
s = s.replace('/* ============ 击杀掉落卡', '''/* ============ 露娜2 分站：hero 倒计时与资质说明 ============ */
.game-hero .launch-cd{margin-top:4px}
.game-hero .cd-unit{min-width:56px;padding:7px 6px 5px}
.game-hero .cd-unit b{font-size:19px}
.luna-legal{margin-top:16px;font-size:11px;line-height:1.9;color:#5F6580}

/* ============ 击杀掉落卡''', 1)

io.open(p, 'wb').write(s.replace('\n', '\r\n').encode('utf-8'))
print('style.css ok')
