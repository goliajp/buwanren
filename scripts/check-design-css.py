#!/usr/bin/env python3
"""设计文档里用到的 CSS 变量，doc.css 必须真定义过。

起因：两份文档从深色版改成浅色版时，样式表换了，但内联 SVG 里的
`fill="var(--ink-2)"` 一类没跟着改 —— 共 14 处。这种失效不报错、不留白，
浏览器按初始值渲成纯黑，看着就是「一根颜色略深的箭头」，肉眼几乎看不出来。
够不着的检查不该打分，所以这里连 SVG 属性里的 var() 一起扫。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DESIGN = ROOT / '.claude/design'
CSS = DESIGN / 'doc.css'

if not CSS.exists():
    print(f'✗ 找不到 {CSS.relative_to(ROOT)}')
    sys.exit(1)

共用的 = set(re.findall(r'^\s*(--[a-z0-9-]+)\s*:', CSS.read_text(encoding='utf-8'), re.M))


def 这份定义了(src):
    """一份文档【自己 <style> 里】定义的变量也算数。

    0830 版带着自己的产品色板（那份文档本身就是新视觉的展示），
    定义在它自己的 style 块里 —— 只认 doc.css 的话，这些会被报成
    「悄悄失效」，而它们明明生效着。检查面不够宽就会把对的说成错的，
    那跟漏掉错的一样坏:两种都让人不再信这一支。
    """
    块 = re.findall(r'<style[^>]*>(.*?)</style>', src, re.S)
    # 【不要求行首】—— 一行里写好几个变量是常见写法（0830 的色板就是），
    # 只认行首的话它们从第二个起全被当成没定义。
    # 前面不能是「(」，那样才不会把 `var(--x)` 里的名字算成定义。
    return set(re.findall(r'(?<!\()(--[a-z0-9-]+)\s*:', '\n'.join(块)))
docs = sorted(DESIGN.glob('*.html'))
if not docs:
    print('✗ .claude/design/ 下没有 html —— 这道检查够不着它要管的东西')
    sys.exit(1)

bad = 0
for d in docs:
    src = d.read_text(encoding='utf-8')
    defined = 共用的 | 这份定义了(src)
    # 同一个标签写两个 class：HTML 只认第一个，第二个整个丢掉。
    # 实际后果是「这行字本来该是红的，一直是灰的」—— 不报错、不留白，只是颜色不对。
    dup = re.findall(r'<\w+[^>]*?\sclass="[^"]*"[^>]*?\sclass="[^"]*"[^>]*?>', src)
    for d2 in dup:
        print(f'✗ {d.name}　同一标签两个 class，后一个不生效：{d2[:78]}')
    bad += len(dup)

    # 文档内锚点：指向不存在的 id 时，点击毫无反应 —— 不报错、不跳转，
    # 看起来就像「这一条恰好没做成链接」。章节一改号就会集体失效。
    ids = set(re.findall(r'<(?:section|div|h\d)[^>]*\sid="([^"]+)"', src))
    for h in set(re.findall(r'href="#([^"]+)"', src)):
        if h not in ids:
            print(f'✗ {d.name}　目录/正文里的 #{h} 指向不存在的锚点')
            bad += 1

    # 来源代号：正文里写 [C]，附录的来源表里就必须有一行 [C]。
    # 按「数据出处」那一节切开 —— 之前的写法靠匹配 td 的形状，
    # 换一种写法就认不出来，于是 [库] 被误报成没定义。以位置为准更稳。
    if '<section id="src">' in src:
        body, appendix = src.split('<section id="src">', 1)
        code = r'\[([A-Z]\*?|库)\]'
        cited = set(re.findall(r'class="src-t">\s*' + code, body))
        cited |= set(re.findall(r'<text class="src[^"]*"[^>]*>\s*' + code, body))
        listed = set(re.findall(code, appendix))
        # 图里自带的小来源表也算定义
        listed |= set(re.findall(r'class="src-b"[^>]*>\s*' + code, body))
        for c in sorted(cited - listed):
            print(f'✗ {d.name}\u3000正文引用了来源 [{c}]，附录来源表里没有这一行')
            bad += 1

    used = {}
    for m in re.finditer(r'var\((--[a-z0-9-]+)\)', src):
        used.setdefault(m.group(1), 0)
        used[m.group(1)] += 1
    for name, n in sorted(used.items()):
        if name not in defined:
            print(f'✗ {d.name}　{name} 用了 {n} 次，doc.css 里没定义')
            bad += n

print(f'{"✗" if bad else "✓"} 扫 {len(docs)} 份文档 · 共用变量 {len(共用的)} 个'
      f'（各文档自己 <style> 里定义的另算）· 悄悄失效的地方 {bad} 处')
sys.exit(1 if bad else 0)
