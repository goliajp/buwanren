#!/usr/bin/env python3
"""四十位的头像都接上了没。

四十位的正面像素图早就画在设计册里（charsheet.js 的 CHARSPEC），
但小程序这一侧一直是「圆底 + 姓名末字」—— 缺的不是画，是接线。
`rooms/tools/export-faces.mjs` 把它们导成 engine/faces.js。

这一支盯三件事:
  · 每位村民都有脸（导出漏人会让那几位悄悄退回姓名末字）
  · 每张脸都是能解码的 PNG，且不是一片空白
  · 用到头像的每一屏都走 `脸()`，没有谁还在裸写姓名末字

判据落在产物上，因为产物才是真上屏的东西。产物没生成时说清楚，
不假装通过 —— 那正是「跳过不是通过」。
"""
import base64, json, pathlib, re, struct, subprocess, sys, zlib

根 = pathlib.Path(__file__).resolve().parent.parent
产物 = 根 / 'mini/miniprogram/engine/faces.js'
if not 产物.exists():
    print('✗ engine/faces.js 还没生成 —— 跑一遍 bun rooms/tools/export-faces.mjs')
    sys.exit(1)

s = 产物.read_text(encoding='utf-8')
m = re.search(r'module\.exports = (\{.*\})\s*$', s, re.S)
if not m:
    print('✗ engine/faces.js 读不出内容 —— 导出写坏了'); sys.exit(1)
脸 = json.loads(m.group(1))

# 村民名单从种子文件读，不连库 —— 门禁要在没有 Postgres 的机器上也跑得动。
# 【只取 villager 那一段】:同一个文件里还有 art（术数）表，
# 它的行长得一模一样（'tarot','塔罗'），一起读进来就会报「塔罗没有头像」——
# 而塔罗不是人。
种 = (根 / 'backend/seed/villagers.sql').read_text(encoding='utf-8')
段 = re.search(r'INSERT INTO villager \(.*?;', 种, re.S)
if not 段:
    print('✗ 读不出 villager 那一段 —— 这一支够不着要验的东西'); sys.exit(1)
村民 = re.findall(r"^\s*\('([a-z_]+)',\s*'([^']+)'", 段.group(0), re.M)
if not 村民:
    print('✗ 读不出村民名单 —— 这一支够不着要验的东西'); sys.exit(1)

错 = []
for vid, 名 in 村民:
    图 = 脸.get(vid)
    if not 图:
        错.append(f'{名}({vid}) 没有头像 —— 那一位会退回姓名末字')
        continue
    try:
        raw = base64.b64decode(图.split(',', 1)[1])
        assert raw[:8] == b'\x89PNG\r\n\x1a\n', 'PNG 头不对'
        w, h = struct.unpack('>II', raw[16:24])
        assert 8 <= w <= 64 and 8 <= h <= 64, f'尺寸怪:{w}×{h}'
        # 解一遍 IDAT，确认不是一张全透明的空图
        i, 数据 = 8, b''
        while i < len(raw):
            n = struct.unpack('>I', raw[i:i+4])[0]
            if raw[i+4:i+8] == b'IDAT': 数据 += raw[i+8:i+8+n]
            i += 12 + n
        像素 = zlib.decompress(数据)
        不透明 = sum(1 for k in range(0, len(像素)) if (k % (1 + w*4)) and (k % 4 == 0) and 像素[k])
        assert 不透明 > 20, '几乎全透明 —— 是张空图'
    except Exception as e:
        错.append(f'{名}({vid}) 的头像坏了：{e}')

# 用到头像的屏，必须走 脸()，不许自己裸写末字
页 = 根 / 'mini/miniprogram/pages'
注释 = re.compile(r'<!--.*?-->', re.S)
for f in sorted(页.glob('*/index.wxml')):
    源 = 注释.sub('', f.read_text(encoding='utf-8'))
    有头像 = ('face-{{' in 源) or ('soon-face' in 源) \
             or re.search(r'class="[^"]*\bface-(move|still|keep|let_go|ask|near|wait)\b', 源)
    if not 有头像:
        continue
    ts = (f.parent / 'index.ts').read_text(encoding='utf-8')
    # 判据是【头像元素绑了 style】——铺真脸只能靠它。
    # 原先卡在「必须叫『脸样』」，而改名字那一屏用的是「婆脸」「苏脸」，
    # 于是那一屏漏过去了:两个预览气泡还顶着写死的「婆」「苏」两个字。
    标签 = re.findall(r'<view\b[^>]*>', 源, re.S)
    头像行 = [t for t in 标签
              if re.search(r'class="[^"]*\b(face|who-face|item-face|peek-face|soon-face|say-face|glyph)\b', t)]
    # 两种不算:骨架屏的占位（`sk-` 开头，那是加载态，本来就没有人），
    # 和【村子自己说话】那一格（`intro-face`，说话的是屋子不是人，村子没有脸）。
    头像行 = [行 for 行 in 头像行 if 'sk-' not in 行 and 'intro-face' not in 行]
    有插值样式 = re.compile(r'style="[^"]*\{\{')
    没铺图 = [t.strip().replace('\n', ' ')[:52] for t in 头像行 if not 有插值样式.search(t)]
    if "utils/face" not in ts:
        错.append(f'{f.parent.name} 屏上有头像，却没接 utils/face —— 那一屏还是圆底加一个字')
    elif 没铺图:
        错.append(f'{f.parent.name} 有 {len(没铺图)} 处头像没绑 style（铺不上真脸）：{没铺图[0]}')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'四十位的脸 · 导出 {len(脸)} 位 · 用到头像的屏都接上了')
sys.exit(1 if 错 else 0)
