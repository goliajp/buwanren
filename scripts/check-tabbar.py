#!/usr/bin/env python3
"""底栏三项都要有图标，选中色要是主色。

2026-09-01 之前底栏是三个纯文字标签，选中态只是「灰字变黑字」，
而那个黑（#1a1a1c）既不是 --ink 也不是 --amber —— 主色在导航里
一次都没出现过。三个文字标签加黑色选中，是「这是个通用小程序」
这个印象最直接的来源（五路评审 · 视觉）。

判据:
  · 每一项都得有 iconPath 与 selectedIconPath，且文件真的在
  · 选中色必须是色板里的【琥珀字色】，未选中色必须是次要文字色 —— 不许自创
  · 图标是像素画，边长得能被 16 整除（放大倍数是整数，才不会糊）
"""
import json, re, struct, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
app = json.loads((根 / 'mini/miniprogram/app.json').read_text(encoding='utf-8'))
t = app.get('tabBar')
if not t or not t.get('list'):
    print('✗ app.json 里没有 tabBar —— 这一支够不着要验的东西')
    sys.exit(1)

def 图里有色(raw, 十六进制):
    """这张 PNG 里出现过这个颜色吗。

    自己解 PNG（zlib + 逐行 unfilter）—— 为这点事装图像库不值得，
    而这几张图是本仓自己生成的，格式固定（8 位 RGBA，无隔行）。
    格式对不上就返回 None，调用方当作「说不准」放过 —— 不假装量过。
    """
    import zlib
    try:
        if raw[:8] != b'\x89PNG\r\n\x1a\n':
            return None
        w, h = struct.unpack('>II', raw[16:24])
        深, 型 = raw[24], raw[25]
        if 深 != 8 or 型 != 6 or raw[28] != 0:      # 只认 8 位 RGBA、非隔行
            return None
        数据 = b''.join(raw[i + 8:i + 8 + struct.unpack('>I', raw[i:i + 4])[0]]
                        for i in 块位置(raw, b'IDAT'))
        像素 = zlib.decompress(数据)
        目标 = tuple(int(十六进制.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
        每行 = w * 4
        上一行 = bytearray(每行)
        off = 0
        for _ in range(h):
            f = 像素[off]; off += 1
            行 = bytearray(像素[off:off + 每行]); off += 每行
            for x in range(每行):                    # 逐行反滤波
                a = 行[x - 4] if x >= 4 else 0
                b = 上一行[x]
                c = 上一行[x - 4] if x >= 4 else 0
                if f == 1: 行[x] = (行[x] + a) & 255
                elif f == 2: 行[x] = (行[x] + b) & 255
                elif f == 3: 行[x] = (行[x] + (a + b) // 2) & 255
                elif f == 4:
                    pp = a + b - c
                    pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                    行[x] = (行[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
            for x in range(0, 每行, 4):
                if 行[x + 3] > 8 and (行[x], 行[x + 1], 行[x + 2]) == 目标:
                    return True
            上一行 = 行
        return False
    except Exception:
        return None


def 块位置(raw, 类型):
    i = 8
    while i + 8 <= len(raw):
        n = struct.unpack('>I', raw[i:i + 4])[0]
        if raw[i + 4:i + 8] == 类型:
            yield i
        i += 12 + n


样式 = (根 / 'mini/miniprogram/app.wxss').read_text(encoding='utf-8')
变量 = dict(re.findall(r'(--[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;', 样式))
错 = []
# 【底栏那两个色是【字】色，不是结构色】（2026-09-02）。
# 这一支原先钉的是 `--amber-deep`（#E8791A）—— 那是结构色:底、描边、
# 投影、渐变站。它压在纸底上只有 2.86:1，而底栏选中态那行字
# 正是告诉你「你在哪儿」的那一句，它由微信按 app.json 画，
# 任何样式表门禁都够不着（是镜像里那支浏览器实测的对比度抓到的）。
# 色板早已把两个身份拆开（app.wxss 里 --amber-text / --on-amber 那一段），
# 这一支跟着改钉 `--amber-text`(#A34700，压纸 5.93:1)。
# 「不许自创」那条不变 —— 变的只是钉哪一个变量。
主色 = (变量.get('--amber-text') or '').lower()
次色 = (变量.get('--ink-faint') or '').lower()

if (t.get('selectedColor') or '').lower() != 主色:
    错.append(f'选中色是 {t.get("selectedColor")}，而琥珀字色是 {变量.get("--amber-text")} —— '
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
        # 【图里得真有那个色】。上一版只比对 app.json 里的两个字符串 ——
        # 于是 2026-09-01 把选中色从 --amber-deep 改钉 --amber-text 之后，
        # 字变成了 #A34700 而图标还是 #FF9A3C:同一格里两个橙，
        # 而 `#A34700` 在六张图里【一个像素都没有】，图比字浅了近三倍
        # （2026-09-02 第三轮评审 · 视觉逐张取色发现）。
        # 判据:选中态的图里必须出现选中色，未选中态的图里必须出现未选中色。
        想要 = (t.get('selectedColor') if k == 'selectedIconPath' else t.get('color')) or ''
        if 想要 and 图里有色(raw, 想要) is False:
            错.append(f'{路} 里没有 {想要} —— 那是同一格里那行字的颜色。'
                      f'图跟字不是一个色，选中态就成了两个橙')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'底栏 {len(t["list"])} 项都有像素图标 · '
      f'选中 {t.get("selectedColor")} · 未选中 {t.get("color")}')
sys.exit(1 if 错 else 0)
