#!/usr/bin/env python3
"""屋里的台词也不许有文言和行话。

台词有三套源，各自独立:
  · `villager_line`（村子首页那句「今天说」）—— check-villager-lines.py 管
  · 界面文案（wxml）—— check-plain-words.py 管
  · **屋里的气泡**（rooms/src/rooms/*.js 的 `say:` / `lines:`）—— 从前没人管

第三套恰恰是用户看得最久的:点进屋子，村民头顶自动一句一句地冒。
2026-09-01 五路评审在这儿抓到一整片:丹增说了三次「贫僧」，
沈砚「此字」「恕我直言」，阿云「此卦大吉」「此局何解」，
桃桃把「休门」说了三遍 —— 而「休门」正是结果屏明令一个都不留的那个词。

判据跟另外两支同一套词表，只是扫的文件不同;注释里讨论这些词是允许的。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
屋 = sorted((根 / 'rooms/src/rooms').glob('*.js'))
if not 屋:
    print('✗ 一间房都没扫到 —— 这一支在空转'); sys.exit(1)

文言 = ['贫道', '贫僧', '老衲', '小生', '在下', '足下', '尔等', '此字', '此卦', '此局',
        '何解', '恕我直言', '今日', '不宜', '窃以为', '不才', '愚见', '大吉大利']
行话 = ['三奇六仪', '值符', '休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门',
        '紫微', '天府', '命盘', '断语', '起局', '起课', '排盘', '大六壬', '奇门遁甲',
        '梅花易数', '八字', '日主', '用神', '格局']

# 只看真的会显示出来的字符串:say / lines / labels
串 = re.compile(r"(?:say|pSay|labels|lines)\s*:\s*(\[[^\]]*\]|'(?:[^'\\]|\\.)*')", re.S)
错, 条数 = [], 0
for f in 屋:
    源 = f.read_text(encoding='utf-8')
    # 整块注释挖掉 —— 里面讨论这些词是允许的（换成等长空白，行号不漂）
    净 = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), 源, flags=re.S)
    净 = re.sub(r'//[^\n]*', lambda m: ' ' * len(m.group(0)), 净)
    for m in 串.finditer(净):
        for 句 in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1)):
            if not 句:
                continue
            条数 += 1
            行 = 净[:m.start()].count('\n') + 1
            for 词 in 文言:
                if 词 in 句:
                    错.append(f'{f.name}:{行}　文言「{词}」：{句}')
            for 词 in 行话:
                if 词 in 句:
                    错.append(f'{f.name}:{行}　行话「{词}」：{句}')
            if re.search(r'[一-龥][,?!;:]|[,?!;:][一-龥]', 句):
                错.append(f'{f.name}:{行}　半角标点：{句}')

if 条数 < 40:
    print(f'✗ 只抠出 {条数} 句台词 —— 六间房不该这么少，这一支多半在空转')
    sys.exit(1)
for e in dict.fromkeys(错):
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'屋里的台词说的是人话 · {len(屋)} 间房 · {条数} 句')
sys.exit(1 if 错 else 0)
