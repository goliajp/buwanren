#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""房间自动发现(Python 侧)—— tools/rooms.js 的等价物,约定完全一致。

js 工具早就走 rooms.js 自动发现了,两个 .py 工具却各自留着一张手写清单:
roomstats.py 六间、pathlint.py 六间。手写清单的失败方式是固定的 ——
加房的人忘了改表,工具照常打印「合计 0 处」,看起来像全绿。
沈砚、白鹭两间就这么在门禁外待过一段时间。

约定(与 rooms.js 同):
  房间对象  <NAME>_ROOM(挂 window 或 globalThis 上皆可)且带 plan 数组

  两种前缀都认:房间脚本已经改说 globalThis(小程序没有 window),
  但变异测试会拿历史版本的 design.html 当对照,那些还写着 window。
  只认一种的话,这些工具会在旧文件上「一间房都找不到」——
  而那是它们唯一必须失败的情形,红得毫无信息量。
  画布      <name>Canvas
  主角      <name>              (defineActor 的 id;中文名取其 name 字段)

★ 发现不到任何房间 = 硬失败,不是「没什么可查」。
  一个查不到东西的门禁必须喊,不许安静地退 0 —— 这正是假绿的定义。
"""
import re
import sys


def discover(html):
    """从 design.html 源码里长出房间清单,返回 [(KEY, canvasId, 中文名, base)]"""
    names = dict(re.findall(
        r"defineActor\(\s*['\"]([a-z0-9_]+)['\"]\s*,\s*\{\s*\n?\s*name:\s*['\"]([^'\"]+)['\"]",
        html))
    out = []
    for m in re.finditer(r'(?:window|globalThis)\.([A-Z][A-Z0-9]*)_ROOM\s*=\s*\{', html):
        key = m.group(1) + '_ROOM'
        # 必须带 plan 才算房间 —— 与 rooms.js 的 Array.isArray(plan) 对齐
        if not re.search(r'\bplan:\s*\[', html[m.end():m.end() + 4000]):
            continue
        base = m.group(1).lower()
        out.append((key, base + 'Canvas', names.get(base, base), base))
    return sorted(out)


def discover_or_die(html, tool):
    rooms = discover(html)
    if not rooms:
        print(f'✗ {tool}: 一间房都没发现 —— design.html 变了格式,还是路径给错了?', file=sys.stderr)
        print('  约定见 tools/rooms.py 顶部。查不到东西的门禁必须失败,不能报全绿。', file=sys.stderr)
        sys.exit(2)
    return rooms


if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else 'rooms/design.html'
    for key, canvas, label, base in discover_or_die(open(p, encoding='utf-8').read(), 'rooms.py'):
        print(f'{key:16s} {canvas:16s} {label}')
