#!/usr/bin/env python3
"""签词的落款上不许有古书篇名。

库里 `quote.book` 是「村口的闲话」—— 一个自造的现代出处；
而 `quote.chapter` 存的是「齐物论」「逍遥游」「里仁」「三十三章」，
也就是庄子 / 论语 / 道德经 / 易经的篇名。
拼在一起渲出来是「— 村口的闲话 · 齐物论」:
一来篇名是古书表达（硬要求不许），二来它跟出处自相矛盾 ——
「村口的闲话」不可能有一章叫「齐物论」。正文改写得很干净，毁在落款上。

判据:后端拼 `source` 的两处（结果屏与历史详情）都不许把 chapter 拼进去。
两处必须一致 —— 同一句话在两屏落款不同，比都错更糟。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
文件 = [根 / 'backend/unmei-api/src/ai_compose.rs',
        根 / 'backend/unmei-api/src/routes/naji.rs']
错, 查过 = [], 0
for f in 文件:
    if not f.exists():
        print(f'✗ 找不到 {f.name} —— 这一支够不着要验的东西')
        sys.exit(1)
    s = f.read_text(encoding='utf-8')
    净 = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    净 = re.sub(r'//[^\n]*', '', 净)
    # 落款是怎么来的:`source:` 后面那一段，或 `let source = …;`
    # 两种写法都要认 —— 只认一种的话，改成另一种写法就静默不查了
    for m in re.finditer(r'(?:source\s*:|let\s+source\s*=)\s*(.+?)[,;]\n', 净, re.S):
        片 = m.group(1)
        if 片.strip() == 'source':           # `QuoteOut { text, source }` 那种转手，不算一处
            continue
        查过 += 1
        if 'chapter' in 片:
            行 = 净[:m.start()].count('\n') + 1
            错.append(f'{f.name}:{行}　落款里拼进了 chapter —— 那是古书篇名：{片.strip()[:60]}')
if 查过 < 2:
    print(f'✗ 只找到 {查过} 处落款拼装 —— 该有两处（结果屏 + 历史详情），这一支多半在空转')
    sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'签词落款上没有古书篇名 · 查了 {查过} 处')
sys.exit(1 if 错 else 0)
