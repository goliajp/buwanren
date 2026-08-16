# -*- coding: utf-8 -*-
"""把 sprite 渲染成 PNG,让我自己看"""
from PIL import Image, ImageDraw, ImageFont
import sys
sys.path.insert(0, '/tmp/rules')
exec(open('/tmp/rules/world.py').read())
exec(open('/tmp/rules/spr_orig.py').read())

SCALE = 6          # 每格 6px
PAD = 8
COLS = 8
NAME = {c[0]: c[1] for c in CAST}

def grid_of(cid):
    hd, bd, H, F, C, A, E, Y, W = S[cid]
    if cid in ANIMAL:
        pal = {'K':OUT.get(cid,'#3a2c20'),'H':H,'F':F,'C':C,'A':A,'W':EYES.get(cid,'#2a2018'),'E':'#e89080','Y':Y}
        return ANIMAL[cid].split('\n'), pal
    hr = HEAD[hd].split('\n')
    while hr and set(hr[0]) <= {'.'}: hr.pop(0)
    while hr and set(hr[-1]) <= {'.'}: hr.pop()
    hr = apply_shape(hr, SHAPE.get(cid, 'round'))
    hr = apply_face(hr, FACE_OF.get(cid, 'normal'))
    rows = hr + apply_build(BODY[bd].split('\n'), BUILD.get(cid, 'norm'))
    rows = ['.' * 14] * (16 - len(rows)) + rows
    eye = EYES.get(cid, '#2a2018')
    pal = {'K':OUT.get(cid,'#3a2c20'),'H':H,'F':F,'C':C,'A':A,'W':eye,'E':'#e89080','Y':Y,'R':'#e87a98'}
    return rows, pal

def render(ids, out, cols=COLS):
    n = len(ids)
    rows_n = (n + cols - 1) // cols
    cw, ch = 14*SCALE + PAD*2, 16*SCALE + PAD*2 + 14
    img = Image.new('RGB', (cw*cols, ch*rows_n), '#faf2dc')
    d = ImageDraw.Draw(img)
    try: font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 11)
    except: font = ImageFont.load_default()
    for i, cid in enumerate(ids):
        gx, gy = (i % cols) * cw, (i // cols) * ch
        d.rectangle([gx+2, gy+2, gx+cw-3, gy+ch-3], outline='#c8bca4')
        rows, pal = grid_of(cid)
        for r, row in enumerate(rows):
            for c, chx in enumerate(row):
                if chx in ('.', ' '): continue
                col = pal.get(chx, '#3a2c20')
                x0 = gx + PAD + c*SCALE
                y0 = gy + PAD + r*SCALE
                d.rectangle([x0, y0, x0+SCALE-1, y0+SCALE-1], fill=col)
        d.text((gx+PAD, gy+ch-16), NAME[cid], fill='#3a2c20', font=font)
    img.save(out)
    return out

if __name__ == '__main__':
    ids = [c[0] for c in CAST]
    render(ids[:16], '/tmp/rules/sheet1.png')
    render(ids[16:32], '/tmp/rules/sheet2.png')
    render(ids[32:], '/tmp/rules/sheet3.png')
    print('渲染完成')
