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
    if 'face-{{' not in 源 and 'soon-face' not in 源:
        continue
    ts = (f.parent / 'index.ts').read_text(encoding='utf-8')
    if '脸样' not in 源 or "utils/face" not in ts:
        错.append(f'{f.parent.name} 屏上有头像，却没接 脸() —— 那一屏还是圆底加一个字')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'四十位的脸 · 导出 {len(脸)} 位 · 用到头像的屏都接上了')
sys.exit(1 if 错 else 0)
