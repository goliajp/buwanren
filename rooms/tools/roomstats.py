#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
roomstats —— 房间数据对表

把「这间房做够了没有」从看感觉变成看数字。阿云房与桃桃房是前两间做到线的，
它们的实测值就是 36 间村民房的参照范围 —— 不是配额，是**量级**：
差一个数量级说明漏了整类东西（比如某间房一句台词都没有、或者一件可点的都没有）。

统计维度与它们各自说明什么：
  plan 件数 / 素材种数   陈设密度。种数远小于件数说明复用得好
  可点击件 / 占比        交互覆盖。「交互是角色档案的出口」，占比过低 = 房间是哑的
  台词条数（含追问层）    角色声音的总量
  可行动格数             40px 网格里角色真正走得到的格子，从门口 BFS
  光源 / 特效 / 有状态件  氛围与动态
  角色 / 姿态 / 行为数    这间房住着几个活物、各有多少动作

用法：python3 tools/roomstats.py <design.html> [房间1 房间2 ...]
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rooms as rooms_py
from collections import deque

CELL = 40

def parse(path):
    return open(path, encoding='utf-8').read()

def assets(s):
    """素材 id → (w, h, foot, 是否可点, say, sayDeep, 有光, 有fx, 有变体)"""
    out = {}
    for m in re.finditer(r'def\(["\']([a-z0-9_]+)["\'],\s*\{(.{0,700})', s, re.S):
        b = m.group(2)
        g = lambda p: re.search(p, b)
        w = g(r'\bw:\s*(\d+)'); h = g(r'\bh:\s*(\d+)')
        f = g(r'foot:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)')
        say = g(r"say:\s*['\"]([^'\"]*)")
        # sayDeep 有两种形态:早期单串 sayDeep: '…',沈砚起是多层数组 sayDeep: ['…','…']。
        # 只认单串曾让沈砚(37 件)白鹭(36 件)整列报 0 —— 又一次「工具报零先怀疑工具」
        deep = g(r"sayDeep:\s*(?:['\"]([^'\"]*)|\[)")
        out[m.group(1)] = dict(
            w=int(w.group(1)) if w else 0, h=int(h.group(1)) if h else 0,
            foot=tuple(int(f.group(i)) for i in (1,2,3,4)) if f else (0,0,0,0),
            click='clickable' in b, say=say.group(1) if say else None,
            deep=(deep.group(1) or '[…]') if deep else None,  # 数组形态无捕获组,给占位真值
            light=bool(g(r'\blight:')), fx=bool(g(r'\bfx\(')), variant=bool(g(r'\bvariant\(')))
    return out

def room_plan(s, key):
    # 必须匹配【赋值】而不是任意引用 —— find('window.AYUN_ROOM') 会命中读它的代码，
    # 然后 plan: 一路找到隔壁房间去，两间房于是统计出一模一样的数字。
    m = re.search(r'(?:window|globalThis)\.' + key + r'\s*=\s*\{', s)
    if not m: return []
    i = m.end()
    j = s.find('plan:', i); k = s.find('\n  }', j)
    return [(m.group(1), int(m.group(2)), int(m.group(3)))
            for m in re.finditer(r"\['([a-z0-9_]+)',\s*(\d+),\s*(\d+)", s[j:k])]

def room_script(s, canvas):
    i = s.find("getElementById('%s')" % canvas)
    if i < 0: return ''
    # 从取画布那一行【往回】找到整个 <script> 块。房间脚本已经把宿主那一段
    # (取画布、驱动帧)挪到文件末尾,从那一行往后切等于什么都没切到。
    return s[s.rfind('<script', 0, i):s.find('</script>', i)]

def walkable(items, A, w=1440, h=2560, wall=430, ext=2160):
    """从门口 BFS，数出真正走得到的 40px 格子"""
    busy = set()
    for n, x, y in items:
        a = A.get(n)
        if not a or a['foot'] == (0,0,0,0): continue
        fx, fy, fw, fh = a['foot']
        x0, y0 = x + fx, y + fy
        for cx in range(max(0, x0)//CELL, (x0 + fw)//CELL + 1):
            for cy in range(max(0, y0)//CELL, (y0 + fh)//CELL + 1):
                busy.add((cx, cy))
    W, H0, H1 = w//CELL, wall//CELL, ext//CELL
    start = (w//2//CELL, (ext - 40)//CELL)
    seen, q = {start}, deque([start])
    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            n2 = (cx+dx, cy+dy)
            if 0 <= n2[0] < W and H0 <= n2[1] < H1 and n2 not in seen and n2 not in busy:
                seen.add(n2); q.append(n2)
    return len(seen), W * (H1 - H0)

def stats(s, key, canvas, label):
    A = assets(s)
    items = room_plan(s, key)
    uniq = []
    for n, _, _ in items:
        if n not in uniq: uniq.append(n)
    click = [n for n in uniq if A.get(n, {}).get('click')]
    lines = [A[n]['say'] for n in uniq if A.get(n, {}).get('say')]
    deeps = [A[n]['deep'] for n in uniq if A.get(n, {}).get('deep')]
    seg = room_script(s, canvas)
    acts = re.findall(r"\{\s*id:\s*'(\w+)',[^{}]*node:", seg)
    poses = re.findall(r"pdef\('(\w+)'", seg)
    actors = re.findall(r"defineActor\('(\w+)'", s)
    act_says = re.findall(r"say:\s*'([^']*)'", seg)
    for arr in re.findall(r"say:\s*\[([^\]]*)\]", seg):
        act_says += re.findall(r"'([^']*)'", arr)
    reach, total = walkable(items, A, ext=2160)
    return dict(label=label, plan=len(items), kinds=len(uniq),
                click=len(click), lines=len(lines), deep=len(deeps),
                actsay=len(act_says), acts=len(acts), poses=len(poses),
                light=sum(1 for n in uniq if A.get(n,{}).get('light')),
                fx=sum(1 for n in uniq if A.get(n,{}).get('fx')),
                variant=sum(1 for n in uniq if A.get(n,{}).get('variant')),
                reach=reach, total=total)

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'rooms/design.html'
    s = parse(path)
    want = sys.argv[2:]
    # 房间清单自己长出来 —— 从前这里写死前四间,沈砚白鹭从未被统计过而工具照常报数
    rooms = rooms_py.discover_or_die(s, 'roomstats')
    rows = [stats(s, k, c, l) for k, c, l, _ in rooms
            if not want or l in want or c in want]
    if not rows:
        print('筛选条件没匹配到房间:' + ' '.join(want)); sys.exit(2)
    F = [('plan 件数','plan'), ('素材种数','kinds'), ('可点击件','click'),
         ('素材台词','lines'), ('追问台词','deep'), ('行为台词','actsay'),
         ('行为数','acts'), ('姿态数','poses'),
         ('光源','light'), ('特效 fx','fx'), ('有状态件','variant'),
         ('可行动格','reach')]
    w = max(len(n) for n, _ in F) + 2
    print('%s%s' % (' ' * w, ''.join('%-10s' % r['label'] for r in rows)))
    for name, k in F:
        print('%-*s%s' % (w, name, ''.join('%-10s' % r[k] for r in rows)))
    print('%-*s%s' % (w, '可行动率', ''.join('%-10s' % ('%.0f%%' % (100*r['reach']/r['total'])) for r in rows)))
    print('%-*s%s' % (w, '交互覆盖', ''.join('%-10s' % ('%.0f%%' % (100*r['click']/max(r['kinds'],1))) for r in rows)))
    print('%-*s%s' % (w, '台词合计', ''.join('%-10s' % (r['lines']+r['deep']+r['actsay']) for r in rows)))

if __name__ == '__main__':
    main()
