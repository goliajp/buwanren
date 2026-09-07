#!/usr/bin/env python3
"""屏上答应过的事，代码里得真有那件事。

这一轮三路验证的 35 条里，**至少 20 条是同一个形状**:屏上写着一句话，
而代码里没有对应的行为 —— 停订说「最后一盒还会发」而那天什么都不建；
协议写着「签收前可以取消」而付完就没有那颗按钮；「按你缺的那样配」
而订单从来不记你缺哪一样。这一类缺陷不报错、不掉测试、不掉类型，
**只有人从头读一遍才发现**，所以每一轮都要重读一遍同样的东西。

判据在 `scripts/promises.json`。每一条两侧都钉住:

  【屏上】那句话必须还在那个文件里 —— 改文案会红
  【判据】必须成立           —— 改行为会红

两侧都守，是因为这一类缺陷从两个方向长出来:文案先写好、功能没跟上；
或者功能改了、文案留在原地。只守一侧的门禁挡得住一半，
而挡住一半的门禁比没有更危险 —— 它给的是「验过了」的错觉。

**红了不要把它改绿**。红只说明这句话与这件事分开了，
要做的是重新想一遍：这句话现在还算不算数？算数就把行为补上，
不算数就把话改掉，然后把这一条的判据一起重写。

判据要指到【行为】。拿另一句文案证一句文案等于什么都没验 ——
两句都是话，一起错的时候一起绿。

用法: python3 scripts/check-promises.py
      读 PSQL_URL / DATABASE_URL，都没有就退回本机 docker
"""
import json
import os
import pathlib
import subprocess
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
台账 = 根 / 'scripts/promises.json'

跳过后缀 = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2', '.ttf', '.zip'}


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到：{r.stderr.strip()[:200]}')
        sys.exit(2)
    return r.stdout.strip()


def 读(相对):
    p = 根 / 相对
    if not p.exists():
        return None
    return p.read_text(encoding='utf-8')


def 扫一批(目录们, 词):
    """这几个目录底下，哪些文件里出现了这个词。返回 `路径:行号` 列表。

    注释里出现不算 —— 这一支问的是「有没有真接上」，而这个仓的注释
    大量在讲「我们【不】做什么」（`web/runtime/wx.js` 那些 deviceOnly 的
    说明就是），把注释算进来的话每一条都会误报。
    """
    命中 = []
    for d in 目录们:
        base = 根 / d
        if not base.exists():
            continue
        目标 = [base] if base.is_file() else sorted(base.rglob('*'))
        for f in 目标:
            if not f.is_file() or f.suffix in 跳过后缀:
                continue
            try:
                行们 = f.read_text(encoding='utf-8').split('\n')
            except (UnicodeDecodeError, OSError):
                continue
            for n, 行 in enumerate(行们, 1):
                if 词 not in 行:
                    continue
                裸 = 行.strip()
                if 裸.startswith(('//', '*', '/*', '#', '<!--')):
                    continue
                命中.append(f'{f.relative_to(根)}:{n}')
    return 命中


d = json.loads(台账.read_text(encoding='utf-8'))
条目 = d['承诺']
坏 = []
验了 = 0

for c in 条目:
    编号 = c['id']

    # ── 屏上那句话还在吗 ──
    文件, 句 = c['屏上']
    正文 = 读(文件)
    if 正文 is None:
        坏.append((编号, f'屏上那个文件没了：{文件}'))
        continue
    if 句 not in 正文:
        坏.append((编号,
                   f'{文件} 里找不到这句话了：「{句[:40]}…」\n'
                   f'      文案改了 —— 底下那条判据现在还算数吗？'
                   f'重新想一遍再改台账，别顺手把这一条改绿'))
        continue
    验了 += 1

    # ── 代码里真有那件事吗 ──
    for j in c['判据']:
        验了 += 1
        if '库' in j:
            得 = 问库(j['库']) or '空'
            if 得 != j['要']:
                坏.append((编号, f"{j['说']}（库里数出 {得}，该是 {j['要']}）"))
        elif '源' in j:
            正 = 读(j['源'])
            if 正 is None:
                坏.append((编号, f"{j['说']}（{j['源']} 这个文件没了）"))
            elif j['要有'] not in 正:
                坏.append((编号, f"{j['说']}（{j['源']} 里没有「{j['要有'][:40]}」）"))
        elif '扫' in j:
            命中 = 扫一批(j['扫'], j['不许有'])
            if 命中:
                坏.append((编号, f"{j['说']}：{'、'.join(命中[:3])}"))
        else:
            坏.append((编号, f'台账这一条没写判据：{j}'))

if 坏:
    print(f'✗ 屏上答应的事，有 {len(坏)} 处代码里对不上\n')
    for 编号, 话 in 坏:
        print(f'  · {编号}\n      {话}')
    sys.exit(1)

print(f'✓ {len(条目)} 条承诺 · {验了} 处判据 —— 屏上说的与代码做的对得上')
