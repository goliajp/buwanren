#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pathlint —— 走位路径体检

用户问「要怎么才能彻底避免」角色从家具上走过去。答案是：不能靠眼睛盯，要靠这个。

角色穿模有三个来源，只修第三个是不够的：
  ① 锚点落在家具里        → 终点就在柜子里（roomstats 之外，本工具也查）
  ② 路网【边】穿过家具     → 路本身画在柜子里，走多少次穿多少次 ★最隐蔽
  ③ 最后一段直奔锚点      → 从节点到锚点那条直线不经过任何避障

阿云房用 gridPath（网格 BFS，自动绕障），桃桃房用 NAV 路网（手工节点 + 直线边）。
路网的边是人手连的，没有任何机制保证它不穿家具 —— 这正是 ② 的温床。

用法：python3 tools/pathlint.py <design.html>
"""
import re, sys

def seg_rect(x1, y1, x2, y2, rx, ry, rw, rh):
    """线段与矩形是否相交（含包含）"""
    if max(x1, x2) < rx or min(x1, x2) > rx + rw:
        if not (rx <= x1 <= rx+rw or rx <= x2 <= rx+rw): return False
    def side(px, py): return (px - rx, py - ry)
    # 粗筛：包围盒不交则不交
    if max(x1,x2) < rx or min(x1,x2) > rx+rw or max(y1,y2) < ry or min(y1,y2) > ry+rh:
        return False
    # 端点在矩形内
    for px, py in ((x1,y1),(x2,y2)):
        if rx <= px <= rx+rw and ry <= py <= ry+rh: return True
    # 线段与四条边求交
    def inter(ax,ay,bx,by,cx,cy,dx,dy):
        d = (bx-ax)*(dy-cy) - (by-ay)*(dx-cx)
        if d == 0: return False
        t = ((cx-ax)*(dy-cy) - (cy-ay)*(dx-cx)) / d
        u = ((cx-ax)*(by-ay) - (cy-ay)*(bx-ax)) / d
        return 0 <= t <= 1 and 0 <= u <= 1
    E = [(rx,ry,rx+rw,ry), (rx+rw,ry,rx+rw,ry+rh), (rx+rw,ry+rh,rx,ry+rh), (rx,ry+rh,rx,ry)]
    return any(inter(x1,y1,x2,y2,*e) for e in E)

def load(path):
    s = open(path, encoding='utf-8').read()
    A = {}
    for m in re.finditer(r'def\(["\']([a-z0-9_]+)["\'],\s*\{(.{0,320})', s, re.S):
        b = m.group(2)
        w = re.search(r'\bw:\s*(\d+)', b); h = re.search(r'\bh:\s*(\d+)', b)
        f = re.search(r'foot:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', b)
        walk = 'walkable' in b            # 坐垫/门垫能踩，不算障碍
        A[m.group(1)] = (int(w.group(1)) if w else 0, int(h.group(1)) if h else 0,
                         (0,0,0,0) if walk else (tuple(int(f.group(i)) for i in (1,2,3,4)) if f else (0,0,0,0)))
    return s, A

def furniture(s, A, key):
    m = re.search(r'window\.' + key + r'\s*=\s*\{', s)
    if not m: return []
    j = s.find('plan:', m.end()); k = s.find('\n  }', j)
    out = []
    for mm in re.finditer(r"\['([a-z0-9_]+)',\s*(\d+),\s*(\d+)", s[j:k]):
        n, x, y = mm.group(1), int(mm.group(2)), int(mm.group(3))
        w, h, f = A.get(n, (0,0,(0,0,0,0)))
        if f == (0,0,0,0): continue          # 挂件/地毯不占地
        out.append((n, x + f[0], y + f[1], f[2], f[3]))
    return out

FOOT = (48, 136)   # 锚点 → 脚点偏移

def check(path, key, canvas, label):
    s, A = load(path)
    furn = furniture(s, A, key)
    i = s.find("getElementById('%s')" % canvas)
    seg = s[i:s.find('</script>', i)] if i >= 0 else ''
    bad = 0

    nav = re.search(r'const NAV\s*=\s*\{([^}]*)\}', seg)
    edges = re.search(r'const EDGES\s*=\s*\{([^}]*(?:\}[^}]*)*?)\}\s*\n', seg)
    print('\n═══ %s ═══' % label)
    if not nav:
        print('  用网格寻路（gridPath），边由网格保证避障 —— 无路网可查')
    else:
        N = {k: (int(x), int(y)) for k, x, y in re.findall(r'(\w+):\s*\[(\d+),\s*(\d+)\]', nav.group(1))}
        print('  路网 %d 节点' % len(N))
        seen = set()
        for a, lst in re.findall(r'(\w+):\s*\[([^\]]*)\]', edges.group(1) if edges else ''):
            for b in re.findall(r"'(\w+)'", lst):
                if (b, a) in seen or a not in N or b not in N: continue
                seen.add((a, b))
                x1, y1 = N[a]; x2, y2 = N[b]
                for n, fx, fy, fw, fh in furn:
                    if seg_rect(x1, y1, x2, y2, fx, fy, fw, fh):
                        print('  ✗ 边 %s→%s 穿过 %s' % (a, b, n)); bad += 1
        # 节点 → 锚点 的最后一段
        for m in re.finditer(r"\{\s*id:\s*'(\w+)',[^{}]*node:\s*'(\w+)'[^{}]*x:\s*(\d+),\s*y:\s*(\d+)[^{}]*\}", seg):
            aid, nd, ax, ay = m.group(1), m.group(2), int(m.group(3)), int(m.group(4))
            if nd not in N: continue
            x1, y1 = N[nd]; x2, y2 = ax + FOOT[0], ay + FOOT[1]
            for n, fx, fy, fw, fh in furn:
                if seg_rect(x1, y1, x2, y2, fx, fy, fw, fh):
                    print('  ✗ 末段 %s(节点 %s → 锚点) 穿过 %s' % (aid, nd, n)); bad += 1
    # 锚点本身
    for m in re.finditer(r"\{\s*id:\s*'(\w+)',[^{}]*x:\s*(\d+),\s*y:\s*(\d+)[^{}]*\}", seg):
        if 'node:' not in m.group(0): continue
        if 'onTop' in m.group(0): continue      # 猫趴在桌上这类是设定，不是穿模
        fx2, fy2 = int(m.group(2)) + FOOT[0], int(m.group(3)) + FOOT[1]
        for n, fx, fy, fw, fh in furn:
            if fx <= fx2 <= fx + fw and fy <= fy2 <= fy + fh:
                print('  ✗ 锚点 %s 落在 %s 内' % (m.group(1), n)); bad += 1
    print('  %s' % ('✓ 无穿模路径' if bad == 0 else '共 %d 处' % bad))
    return bad

if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else 'mini/design.html'
    total = 0
    for key, cv, lab in [('AYUN_ROOM','ayunCanvas','阿云'), ('TAO_ROOM','taoCanvas','桃桃'),
                         ('POPO_ROOM','popoCanvas','婆婆'), ('TENZ_ROOM','tenzCanvas','丹增')]:
        total += check(p, key, cv, lab)
    print('\n合计 %d 处' % total)
    sys.exit(1 if total else 0)
