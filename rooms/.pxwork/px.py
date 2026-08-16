#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""像素角色草稿渲染器 v3:字面量网格 + PIL 预览(与 design.html B0 同格式)"""
from PIL import Image
import sys, os

OUT = os.path.dirname(os.path.abspath(__file__))

PAL_COMMON = {
    'K': '#3a2c20',
    'F': '#f2c9a0', 'n': '#d9a67b', 'r': '#e89080', 'E': '#2a1c12',
    'w': '#f6f2ea',
}
PALS = {
    'ayun': {**PAL_COMMON,
        'H': '#4a3a2c', 'h': '#33261b', 'j': '#6f5238',
        'B': '#5b7c99', 'b': '#47617c', 'l': '#83a3bd',
        'W': '#f2ede2', 'S': '#3c5468', 'A': '#a06a40',
    },
    'tao': {**PAL_COMMON,
        'H': '#5a3a28', 'h': '#42291a', 'j': '#7a5238',
        'P': '#e87890', 'p': '#c2566e', 'l': '#f4a8b8',
        'W': '#f8f0e8', 'S': '#7a3a4e',
        'D': '#f8a0b8', 'Y': '#ffd76a',
    },
    'tenz': {**PAL_COMMON,
        'F': '#e2b088', 'n': '#bd8a5e',
        'R': '#a8402f', 'm': '#7e2c1e', 'q': '#c05a42',
        'Y': '#e8b23d', 'y': '#b8862a',
        'G': '#6a4526', 'g': '#a87848',
    },
    'popo': {**PAL_COMMON,
        'V': '#7a5a9a', 'v': '#5e4478', 'l': '#9a7ab8',
        'X': '#e8e0d0', 'w': '#c4bba8',
        'Y': '#ffd76a', 'y': '#e8b23d',
        'C': '#a8d8ec', 'c': '#eaf6fc',
    },
}

GRIDS = {}

# ═══════════ 阿云 · 嗜睡小道士(20×32)═══════════
GRIDS['ayun'] = [
"....................",
"........KKKK........",
"...AAAKHHHHKAAA.....",
".......KHHHHK.......",
"......KHHHHHHK......",
".....KHHHjjHHHK.....",
"....KHHHHHHHHHHK....",
"...KHHHHHHHHHHHHK...",
"..KHHHHHHHHHHHHHHK..",
"..KHHHHHHHHHHHHHHK..",
"..KHHHFFHFFFHFFHHK..",
"..KHHFFFFFFFFFFHHK..",
"..KHFFFFFFFFFFFFHK..",
"..KHFFnnnFFnnnFFHK..",
"..KHFFEEEFFEEEFFHK..",
"..KHFrrFFFFFFrrFHK..",
"..KHFFFFFnnFFFFFHK..",
"..KHFFFFFFFFFFFFHK..",
"...KHFFFFFFFFFHK....",
"....KHFFFFFFFHK.....",
".....KKFFFFKK.......",
"....KBBBBBBBBBBK....",
"...KBBBKWWWWKBBBK...",
"...KlBBBKWWKBBBbK...",
"...KlBBBBKKBBBBbK...",
"...KlBBBBBBbBBBbK...",
"...KlBBbBBBbBBbBK...",
"...KlBBbBBBbBBbBK...",
"...KBBbBBBbBBbBBK...",
"...KBBbBBBbBBbBBK...",
"...KBBBBBBBBBBBBK...",
".....KKK....KKK.....",
]

# ═══════════ 桃桃 · 傲娇桃花岛弟子(20×32)═══════════
GRIDS['tao'] = [
"....................",
"...KK..........KK...",
".KHHHHK......KHHHHK.",
".KHHHHK......KHHHHK.",
".KDDDDK.KKKK.KDDDDK.",
"..KKKKKHHHHHHKKKKK..",
"..KHHHHHHHHHHHHHHK..",
".KHHHHHHHHHHHHHHHHK.",
".KHHHjjHHHHHHHHHHHK.",
".KHHHHHHHHHHHHHHHHK.",
".KHHHFFHFFFFHFFFHHK.",
".KHHFFFFFFFFFFFFHHK.",
".KHFFFFFFFFFFFFFFHK.",
".KHFFnnnFFFnnnFFFHK.",
".KHFFEEwFFFwEEFFHK..",
".KHFFEEEFFFEEEFFHK..",
".KHFrFFFFFFFFFFrFHK.",
".KHFFFFFFEEFFFFFFHK.",
".KHFFFFFFFFFFFFFFHK.",
"..KHFFFFFFFFFFFFHK..",
"....KHFFFFFFFFHK....",
".....KKFFFFKK.......",
"....KPPPPPPPPPPK....",
"...KPPPKWWWWKPPPK...",
"...KlPPPKWWKPPPpK...",
"...KSSSSSSSSSSSSK...",
"...KlPPPKSSKPPPpK...",
"...KlPpPPPPpPPPPK...",
"...KlPpPPPPpPPPPK...",
"...KPPpPPPPpPPPPK...",
"...KPPpPPPPpPPPPK...",
".....KKK....KKK.....",
]

# ═══════════ 丹增 · 下山武僧(20×32)═══════════
GRIDS['tenz'] = [
"....................",
"....................",
"......KKKKKKKK......",
"...KFFFFFFFFFFFFK...",
"..KFFFFFFFFFFFFnnK..",
"..KFFFFFFFFFFFFnnK..",
".KnKFFFFFFFFFFFFKnK.",
"..KFFEEFFFFFEEFFFK..",
"..KFFFFFFFFFFFFFFK..",
"..KFFEwEFFFEwEFFFK..",
"..KFFEEEFFFEEEFFFK..",
"..KFFFFFFFFFFFFFFK..",
"..KFFFFFFFnnFFFFFK..",
"...KFFFFFFFFFFFFK...",
"....KFFFFFFFFFFK....",
".....KKFFFFFFKK.....",
".....KGKFFFFKGK.....",
"...KGgGgGgGgGgGgK...",
"..KFFFFKYRRRRRRRRK..",
"..KFFFFnKYRRRRRRRRK.",
".KFFFFFnKYRRRRRRRRK.",
".KFFFFnKYRRRRRRRRRK.",
".KFFFKKqRRRRRRRRRRK.",
".KFFFKqRRRRRRRmRRRRK",
".KFFKqRRRRRRmRRRRRK.",
".KKKKRRRRRRRRmRRRRRK",
".KRRRRRRmRRRRRRRRRK.",
".KRRRRRRmRRRRmRRRRK.",
".KRRRRRRmRRRRmRRRRK.",
".KRRRRRRmRRRRmRRRRK.",
"....KKK......KKK....",
"....KnnK....KnnK....",
]

# ═══════════ 婆婆 · 占卜的老太太(20×32)═══════════
GRIDS['popo'] = [
"....................",
".........KK.........",
"........KYyK........",
"........KyYK........",
".......KVVVVK.......",
"......KVVlVVK.......",
"......KVVVVVVK......",
".....KVVlVVVVK......",
".....KVVVVVVVVK.....",
"....KVVVVVVVVVVK....",
"....KVlVVVVVVVVK....",
"...KVVVVVVVVVVVVK...",
"...KXXXXXXXXXXXXXK..",
"...KXFFFFFFFFFFXK...",
"...KXFFEEFFFEEFXK...",
"...KXrFFFFFFFFrXK...",
"...KXFFFFnnFFFFXK...",
"...KXFFFFFFFFFFXK...",
"....KXFFFFFFFFXK....",
".....KKXFFFFXKK.....",
"......KKFFFFKK......",
"...KVVVVVVVVVVVVK...",
"...KVlVVVVVVVvVVK...",
"...KVVlVVVVVVVvVK...",
"...KVVVVKKKKKVVVK...",
"...KVVVKccCCCCKVVK..",
"...KVFFKCCCCCCKFFVK.",
"...KVFFKCCCCCCKFFVK.",
"...KVVVKCCCCCCKVVK..",
"...KVVVVKKKKKKVVVK..",
"...KVVyVVVVVyVVVVK..",
"...KVVVvVVVVvVVVVK..",
]

SIDES = {}

# ═══════════ 阿云 · 侧(朝右,18×32)═══════════
SIDES['ayun'] = [
"..................",
".......KKK........",
"..AAAKHHHHKAAA....",
"......KHHHHK......",
".....KHHHHHHK.....",
"....KHHHHHHHHK....",
"...KHHHHHHHHHHK...",
"..KHHHHHHHHHHHHK..",
"..KHHHHHHHHHHHHK..",
"..KHHHHHHHHHHHHK..",
"..KHHHHHHHHKFFFFK.",
"..KHHHHHHHKFFFFFK.",
"..KHHHHHHHKFnFFFK.",
"..KHHHHHHHKFEEFFK.",
"..KHHHHHHHKrFFFFK.",
"..KHHHHHHHKFFnFFK.",
"..KHHHHHHHKFFFFK..",
"..KHHHHHHHKFFFK...",
"...KHHHHHHKFFK....",
"....KKKKKKKFK.....",
"......KKKKKKK.....",
".....KBBBBBBBK....",
"....KlBBWBBBBBK...",
"...KlBBWWBBBBBBK..",
"...KlBBWKBBBBBbK..",
"..KlBBBBBBBBBBbK..",
"..KlBBBBBBBBBBbK..",
"..KBBBbBBBBBbBBK..",
"..KBBBbBBBBBbBBK..",
"..KBBBbBBBBBbBBK..",
"...KKK.....KKK....",
"..................",
]

# ═══════════ 桃桃 · 侧(朝右,18×32)═══════════
SIDES['tao'] = [
"..................",
"....KKKK..........",
"...KHHHHK.........",
"...KHHHHK.........",
"...KDDDDK.........",
"...KKKKKHHK.......",
"..KHHHHHHHHHHK....",
".KHHHHHHHHHHHHK...",
".KHHHjHHHHHHHHHK..",
".KHHHHHHHHHHHHHK..",
".KHHHHHHHHKFFFFK..",
".KHHHHHHHKFFFFFK..",
".KHHHHHHHKFnFFFK..",
".KHHHHHHHKEwEFK...",
".KHHHHHHHKEEFK....",
".KHHHHHHHrFFFK....",
".KHHHHHHKFFEFK....",
".KHHHHHHKFFFFK....",
"..KHHHHHKFFFK.....",
"..KHHHHHKFFK......",
"...KKKKKKFK.......",
".....KKKKKKK......",
"....KPPPPPPPPK....",
".KpK.KPPWPPPPPPK..",
".KppKKPWPPPPPPpK..",
".KpKSPPPPPPPPpK...",
"..K.KPPpPPPPPpK...",
"....KPPpPPPPPpK...",
"....KPpPPPPPpPK...",
"....KPPpPPPPPpK...",
"....KKK...KKK.....",
"..................",
]

# ═══════════ 丹增 · 侧(朝右,18×32)═══════════
SIDES['tenz'] = [
"..................",
"..................",
"......KKKKKK......",
"....KFFFFFFFFK....",
"...KFFFFFFFFFFK...",
"...KFFFFFFFFFFK...",
"..KFFFFFFFFFFFFnK.",
"..KFFnFFFFFFFFnK..",
"..KFFnFFFFEEFFnK..",
"..KFFnFFFFFFFFnK..",
"..KFFFFFEwEFFFnK..",
"..KFFFFFEEEFFFnK..",
"..KFFFFFFFFFFnK...",
"..KFFFFFFnFFnK....",
"...KFFFFFFFnK.....",
"....KFFFFFFK......",
".....KKKKKK.......",
"....KGgGgGGgK.....",
"...KFFFFKYRRK.....",
"..KFFFFnKYRRRK....",
"..KFFFFnKYRRRRK...",
"..KFFFFnKqRRRRK...",
"..KFFFKKRRRRRRK...",
"..KFFFKRRRRmRRK...",
"..KFFKRRRRRmRRK...",
"..KKKRRRRRRmRRK...",
"...KRRRRRRRmRRK...",
"...KRRRmRRRmRRK...",
"...KRRRmRRRmRRK...",
"...KRRRmRRRmRRK...",
"....KKK...KKK.....",
]

# ═══════════ 婆婆 · 侧(朝右,18×32)═══════════
SIDES['popo'] = [
"..................",
"......KK..........",
".....KYyK.........",
".....KyYK.........",
"....KVVVVK........",
"...KVVlVVK........",
"...KVVVVVVK.......",
"..KVVlVVVVK.......",
"..KVVVVVVVVK......",
"..KVVVyVVVVK......",
".KVVlVVVVVVK......",
".KVVVVKKFFFFK.....",
".KVVVKXFFFFFFK....",
".KVVVKXFnFFFK.....",
".KVVVKXFEEFK......",
".KVVVKXrFFK.......",
".KVVVKXFFnK.......",
".KVVVKXFFFK.......",
"..KVVKXFFFK.......",
"..KVVKXFFK........",
"..KVKKKKKK........",
".KVVlVVVVVVK......",
".KVlVVVVVVVvK.....",
".KVVKCCCCCKvK.....",
".KVKCccCCCKvK.....",
".KVFKCCCCCKFK.....",
".KVFKCCCCCKFK.....",
".KVKCCCCCCCKVK....",
".KVVKKKKKKVVvK....",
".KVyVVVVVyVVvK....",
".KVVvVVVvVVVvK....",
"..KKKKKKKKKKK.....",
]

BACKS = {}

# ═══════════ 阿云 · 背(20×32)═══════════
BACKS['ayun'] = [
"....................",
"........KKKK........",
"...AAAKHHHHKAAA.....",
".......KHHHHK.......",
"......KHHHHHHK......",
".....KHHHjjHHHK.....",
"....KHHHHHHHHHHK....",
"...KHHHHHHHHHHHHK...",
"..KHHHHHHHHHHHHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"..KHHHhHHHHHHhHHHK..",
"...KHHhHHHHHHhHK....",
"....KHHHHHHHHHHK....",
".....KKKKKKKKK......",
"....KBBBBBBBBBBK....",
"...KBBBKWWWWKBBBK...",
"...KlBBBKWWKBBBbK...",
"...KlBBBBKKBBBBbK...",
"...KlBBBBBBbBBBbK...",
"...KlBBbBBBbBBbBK...",
"...KlBBbBBBbBBbBK...",
"...KBBbBBBbBBbBBK...",
"...KBBbBBBbBBbBBK...",
"...KBBBBBBBBBBBBK...",
".....KKK....KKK.....",
]

# ═══════════ 桃桃 · 背(20×32)═══════════
BACKS['tao'] = [
"....................",
"...KK..........KK...",
".KHHHHK......KHHHHK.",
".KHHHHK......KHHHHK.",
".KDDDDK.KKKK.KDDDDK.",
"..KKKKKHHHHHHKKKKK..",
"..KHHHHHHHHHHHHHHK..",
".KHHHHHHHHHHHHHHHHK.",
".KHHHjjHHHHHHHHHHHK.",
".KHHHHHHHHHHHHHHHHK.",
".KHHHhHHHHHHHHhHHHK.",
".KHHHhHHHHHHHHhHHHK.",
".KHHHhHHHHHHHHhHHHK.",
".KHHHhHHHHHHHHhHHHK.",
".KHHHhHHHHHHHHhHHHK.",
".KHHHhHHHHHHHHhHHHK.",
".KHHHhHHHHHHHHhHHHK.",
".KHHHhHHHHHHHHhHHHK.",
"..KHHhHHHHHHHHhHK...",
"...KHHHHHHHHHHHK....",
"....KKKKKKKKKKK.....",
"....KPPPPPPPPPPK....",
"...KPPPPPPPPPPPPK...",
"...KlPpPPPPPPPPpK...",
"...KlPPPKSSKPPPpK...",
"...KlPPPPSSPPPPpK...",
"...KlPPPKPPKPPPpK...",
"...KlPPPKPPKPPPpK...",
"...KlPpPPPPPPpPPK...",
"...KPPpPPPPPpPPK....",
"...KPPpPPPPPpPPK....",
".....KKK....KKK.....",
]

# ═══════════ 丹增 · 背(20×32)═══════════
BACKS['tenz'] = [
"....................",
"....................",
"......KKKKKKKK......",
"...KFFFFFFFFFFFFK...",
"..KFFFFFFFFFFFFFFK..",
"..KFFFFFFFFFFFFnnK..",
"..KFFFFFFFFFFFFnnK..",
"..KFFFFFFFFFFFFFFK..",
"..KFFFFFFFFFFFFFFK..",
"..KFFFFFFFFFFFFFFK..",
"..KFFFFFFFFFFFFFFK..",
"..KFFFFFFFFFFFFFFK..",
"...KFFFFFFFFFFFFK...",
"....KFFFFFFFFFFK....",
".....KKFFFFFFKK.....",
"......KKKKKKK.......",
"...KYRRRRRRRRRRYK...",
"..KRRRRRRRRRRRRRRK..",
"..KqRRRRmRRRRmRRqK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"..KRRRRRmRRRRmRRRK..",
"....KKK......KKK....",
"....KnnK....KnnK....",
]

# ═══════════ 婆婆 · 背(20×32)═══════════
BACKS['popo'] = [
"....................",
".........KK.........",
"........KYyK........",
"........KyYK........",
".......KVVVVK.......",
"......KVVlVVK.......",
"......KVVVVVVK......",
".....KVVlVVVVK......",
".....KVVVVVVVVK.....",
"....KVVVVyVVVVK.....",
"....KVlVyVyVVVK.....",
"...KVVVVyVyVVVVK....",
"...KVVVVyVVVVVVK....",
"...KVVlVVVVVVVVK....",
"...KVVVVVVVVVVVK....",
"...KVVVVVVVVVVVK....",
"....KVVVVVVVVVK.....",
".....KKKKKKKKK......",
"....KVVVVVVVVVVK....",
"...KVlVVVVVVVVvVK...",
"...KVlVVVVVVVVvVK...",
"...KVVlVVVVVVVvVK...",
"...KVVlVVyVVVVvVK...",
"...KVVlVyVyVVVvVK...",
"...KVVVVyVyVVVvVK...",
"...KVVVVyVVVVvVVK...",
"...KVVVVVVVVVvVVK...",
"...KVVlVVVVVVVvVK...",
"...KVVyVVVVVyVVVVK..",
"...KVVVvVVVVvVVVVK..",
"...KVVVVVVVVVVVVVK..",
".....KKK....KKK.....",
]

def check(name, rows):
    Ws = {len(r) for r in rows}
    if len(Ws) != 1:
        for i, r in enumerate(rows):
            print(f'  r{i} len={len(r)}: |{r}|')
        print(f'[{name}] ragged! widths={Ws}')
    return max(Ws), len(rows)

def render_one(name, rows, pal, scale):
    W, H = check(name, rows)
    img = Image.new('RGBA', (W * scale, H * scale), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in ('.', ' '):
                continue
            c = pal.get(ch)
            if c is None:
                print(f'[{name}] ? char {ch!r} at {x},{y}')
                continue
            rgb = tuple(int(c[i:i+2], 16) for i in (1, 3, 5)) + (255,)
            for dy in range(scale):
                for dx in range(scale):
                    px[x * scale + dx, y * scale + dy] = rgb
    return img

def sheet(names, scale=10, out='sheet.png'):
    imgs = [(n, render_one(n, GRIDS[n], PALS[n], scale)) for n in names]
    gap = 20
    Wt = sum(i.width for _, i in imgs) + gap * (len(imgs) - 1)
    Ht = max(i.height for _, i in imgs)
    sh = Image.new('RGBA', (Wt, Ht), '#efe6d0')
    x = 0
    for _, i in imgs:
        sh.alpha_composite(i, (x, 0))
        x += i.width + gap
    p = os.path.join(OUT, out)
    sh.convert('RGB').save(p)
    print('sheet ->', p)

if __name__ == '__main__':
    which = sys.argv[1:] or list(GRIDS.keys())
    sheet(which)
    for n in which:
        img = render_one(n, GRIDS[n], PALS[n], 12)
        bg = Image.new('RGBA', img.size, '#f4e8cc')
        bg.alpha_composite(img)
        bg.convert('RGB').save(os.path.join(OUT, f'{n}.png'))
    # 侧面 sheet
    imgs = [(n, render_one(n + '_side', SIDES[n], PALS[n], 10)) for n in which if n in SIDES]
    if imgs:
        gap = 20
        Wt = sum(i.width for _, i in imgs) + gap * (len(imgs) - 1)
        Ht = max(i.height for _, i in imgs)
        sh = Image.new('RGBA', (Wt, Ht), '#efe6d0')
        x = 0
        for _, i in imgs:
            sh.alpha_composite(i, (x, 0))
            x += i.width + gap
        sh.convert('RGB').save(os.path.join(OUT, 'sheet_side.png'))
        print('sheet_side ok')
    # 背面 sheet
    imgs = [(n, render_one(n + '_back', BACKS[n], PALS[n], 10)) for n in which if n in BACKS]
    if imgs:
        gap = 20
        Wt = sum(i.width for _, i in imgs) + gap * (len(imgs) - 1)
        Ht = max(i.height for _, i in imgs)
        sh = Image.new('RGBA', (Wt, Ht), '#efe6d0')
        x = 0
        for _, i in imgs:
            sh.alpha_composite(i, (x, 0))
            x += i.width + gap
        sh.convert('RGB').save(os.path.join(OUT, 'sheet_back.png'))
        print('sheet_back ok')
