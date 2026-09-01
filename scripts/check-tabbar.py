#!/usr/bin/env python3
"""底栏三项都要有图标，选中色要是主色。

2026-09-01 之前底栏是三个纯文字标签，选中态只是「灰字变黑字」，
而那个黑（#1a1a1c）既不是 --ink 也不是 --amber —— 主色在导航里
一次都没出现过。三个文字标签加黑色选中，是「这是个通用小程序」
这个印象最直接的来源（五路评审 · 视觉）。

判据:
  · 每一项都得有 iconPath 与 selectedIconPath，且文件真的在
  · 选中色必须是色板里的主色，未选中色必须是次要文字色 —— 不许自创
  · 图标是像素画，边长得能被 16 整除（放大倍数是整数，才不会糊）
"""
import json, re, struct, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
app = json.loads((根 / 'mini/miniprogram/app.json').read_text(encoding='utf-8'))
t = app.get('tabBar')
if not t or not t.get('list'):
    print('✗ app.json 里没有 tabBar —— 这一支够不着要验的东西')
    sys.exit(1)

样式 = (根 / 'mini/miniprogram/app.wxss').read_text(encoding='utf-8')
变量 = dict(re.findall(r'(--[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;', 样式))
错 = []
主色 = (变量.get('--amber-deep') or '').lower()
次色 = (变量.get('--ink-faint') or '').lower()

if (t.get('selectedColor') or '').lower() != 主色:
    错.append(f'选中色是 {t.get("selectedColor")}，而主色是 {变量.get("--amber-deep")} —— '
              f'导航里不该出现色板外的颜色')
if (t.get('color') or '').lower() != 次色:
    错.append(f'未选中色是 {t.get("color")}，而次要文字色是 {变量.get("--ink-faint")}')

for it in t['list']:
    名 = it.get('text', '?')
    for k in ('iconPath', 'selectedIconPath'):
        路 = it.get(k)
        if not 路:
            错.append(f'「{名}」没有 {k} —— 纯文字底栏是「通用小程序」那个印象的来处')
            continue
        f = 根 / 'mini/miniprogram' / 路
        if not f.exists():
            错.append(f'「{名}」的 {k} 指着 {路}，而那个文件不在')
            continue
        raw = f.read_bytes()
        if raw[:8] != b'\x89PNG\r\n\x1a\n':
            错.append(f'{路} 不是 PNG')
            continue
        w, h = struct.unpack('>II', raw[16:24])
        if w % 16 or h % 16:
            错.append(f'{路} 是 {w}×{h} —— 像素画要整数倍放大，边长得能被 16 整除，'
                      f'否则每个源像素的宽窄不一')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'底栏 {len(t["list"])} 项都有像素图标 · '
      f'选中 {t.get("selectedColor")} · 未选中 {t.get("color")}')
sys.exit(1 if 错 else 0)
