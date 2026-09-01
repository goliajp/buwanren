#!/usr/bin/env python3
"""界面上不许有文言与古书的说法。

用户 2026-08-30 定：「完全不允许有任何文言古书的表达，只能是在命理分析中
专业细节中有」。规则不写成代码就会漂 —— 这一支把它钉住。

盯两类：

1. **古称谓与文言虚词**。「娘子」「女冠」「赌坊」「落第」这些词，
   现代汉语里已经不说了;读的人得先在脑子里翻译一遍。
2. **术数术语出现在日常那几屏**。「用神」「日主」「格局」「宜」「忌」
   这些是专业细节，只允许出现在【那一份】（付费分析）里 ——
   村主屏、我家、今天、名册这些每天要用的屏上一个都不许有。

**不扫**：`pages/report/**`（那一份本身就是专业细节所在）、
源码注释（跟其它几支标点门禁的口径一致 —— 注释是写给开发者的）。

★ 手工验这一支时，**别用 `git checkout` 还原变异**。
  它还原的是【整个文件】，会把同一文件里没提交的真改动一起撤掉 ——
  2026-08-30 我就这么把两处刚改好的东西撤没了，而且随后两次提交
  把撤销后的状态一起提交了，门禁连报两轮红我才发现。
  正确做法：先 `cp` 到临时目录，改完再 `cp` 回来。
"""
import os
import re
import subprocess
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页 = 根 / 'mini/miniprogram/pages'

# 古称谓 / 文言虚词。每一个都要能说出「现代人不这么说」
古词 = ['娘子', '女冠', '赌坊', '落第', '婆子', '隐者', '之事', '宜静', '顺势而行',
        '气盈', '养正', '生机萌动', '锋芒外露', '消炁', '化煞', '本命之',
        '者也', '矣', '哉', '乃是', '不亦']
# 术数术语 —— 只许出现在「那一份」里
术语 = ['用神', '日主', '身势', '格局', '大运', '三宫', '胎元', '命宫', '身宫',
        '旬空', '纳音', '藏干', '印星', '比劫', '七杀', '偏财', '正财格', '奇门']
# 那一份自己就是专业细节所在；点香那一屏的「奇门」注脚也是刻意留的
放过 = {'report'}

# 术语里再加两个:它们是这一版从截图上抓到的
术语 += ['起卦', '落卦', '时辰', '八卦', '爻']

错 = []
文件 = sorted(页.glob('*/index.wxml'))
if not 文件:
    print('✗ 一个页面都没找到 —— 这支门禁够不着要验的东西，不算通过')
    sys.exit(1)

for f in 文件:
    屏 = f.parent.name
    s = f.read_text(encoding='utf-8')
    # 注释不扫:它是写给开发者的，跟标点那几支口径一致
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    # 【连 .ts 里的动态文案一起扫】。按钮上写什么常常由 TS 决定
    # （`{{spinning ? '起卦' : '问一件事'}}` 这种），而头一版只扫 wxml ——
    # 于是「起卦」「起卦中…」在核心交互那一屏上待了很久，门禁一路报绿。
    ts = f.parent / 'index.ts'
    if ts.exists():
        源 = ts.read_text(encoding='utf-8')
        # 注释先剥干净 ——  与  两种都剥，
        # 不剥的话注释里提一句「用神」也会被当成屏上的字
        源 = re.sub(r'/\*[\s\S]*?\*/', '', 源)
        源 = re.sub(r'^\s*//[^\n]*$', '', 源, flags=re.M)
        # 【一行之内】的字面量才算 —— 不加 `[^\\n]` 的话，一个不成对的引号
        # 会让正则跨行吞掉整段代码，把变量名（这个仓里真有叫 `用神` 的）
        # 当成屏上的字。判据要能说清自己抓的是什么。
        s += '\n'.join(re.findall(r"'([^'\n]*[一-龥][^'\n]*)'", 源))
    for w in 古词:
        if w in s:
            错.append(f'{屏} 屏上有古称谓「{w}」—— 现代人不这么说，读的人得先翻译一遍')
    if 屏 in 放过:
        continue
    for w in 术语:
        if w in s:
            错.append(f'{屏} 屏上有术语「{w}」—— 专业细节只许留在「那一份」里')

# ── 库里的称谓与文案 ────────────────────────────────────────────
# 【屏上的字有一半不在代码里】。村民的身份（`villager.title`）、术的白话名
# （`art.plain`）、商品名与副标，都从库里来，渲在名册、村主屏、商品卡、
# 确认屏上 —— 而这一支上一版只扫源码，看不见它们。
# 2026-09-02 实测:五个身份是文言（落第书生 / 观里的女冠 / 香药娘子 /
# 看相的婆子 / 隐者），全在第一次来的人最先读到的那几行里，
# 而这一支一路报绿。
#
# 【问库，不读种子文本】。种子改过好几手，只有库知道最后那一版
# （跟 check-no-jargon 那一支同一个理由）。
def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，屏上那半边没验成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]

库里的字 = 问库(
    "SELECT 'villager.title', id, title FROM villager"
    " UNION ALL SELECT 'art.plain', key, plain FROM art WHERE plain IS NOT NULL"
    " UNION ALL SELECT 'product', id, name || ' / ' || COALESCE(sub_title,'')"
    "   FROM product WHERE status='listed'")
if len(库里的字) < 40:
    print(f'✗ 库里只读到 {len(库里的字)} 行 —— 四十位村民就不止这个数，这一段多半没扫到东西')
    sys.exit(1)
for 行 in 库里的字:
    表, 编号, 句 = (行.split('|', 2) + ['', ''])[:3]
    for w in 古词 + 术语:
        if w in 句:
            错.append(f'{表} {编号} 里有「{w}」：{句[:28]} —— 库里的字也是屏上的字')

# ── 屋子里与村图上说的话 ────────────────────────────────────────
# 【这些字也在屏上】。上一版只扫 `pages/**` —— 而村民在自己屋里说的话、
# 路人在村图上说的话，都是玩家看得见的字，它们住在 `rooms/src/` 里。
# 2026-09-02 实测:阿云屋里十二句表演台词有五句是术语堂课
# （四课 / 三传 / 初传中传末传 / 课怎么起），婆婆在村图上说「黄昏是通灵的
# 好时辰」—— 这一支一路报绿，因为它根本没往那儿看。
房间源 = sorted((根 / 'rooms/src/rooms').glob('*.js')) + \
         [根 / 'rooms/src/engine/village.js']
屋里的话 = []
for f in 房间源:
    if not f.exists():
        continue
    源 = f.read_text(encoding='utf-8')
    源 = re.sub(r'/\*[\s\S]*?\*/', '', 源)
    源 = re.sub(r'^\s*//[^\n]*$', '', 源, flags=re.M)
    for m in re.finditer(r"'([^'\n]*[一-龥][^'\n]*)'", 源):
        屋里的话.append((f.name, m.group(1)))
# 【自检按【来源】算，不按总句数算】。头一版写的是「少于 50 句就算失效」——
# 而 village.js 一个文件就有四百多句，于是把六间房的路径整个指错，
# 它照样报绿（2026-09-02 变异测试当场发现）。
# 一个「少扫了六个文件却仍然通过」的门禁，给的是错的信心。
读到的房间 = {名 for 名, _ in 屋里的话} - {'village.js'}
应有的房间 = {f.name for f in (根 / 'rooms/src/rooms').glob('*.js')}
if 读到的房间 != 应有的房间:
    print(f'✗ 房间源对不上:该读 {sorted(应有的房间)}，实际读到 {sorted(读到的房间)}')
    print('  少读一个文件就是少验一整间房，而它会静悄悄地过')
    sys.exit(1)
if not any(名 == 'village.js' for 名, _ in 屋里的话):
    print('✗ 村图那一份（village.js）一句都没读到 —— 路人说的话也是屏上的字')
    sys.exit(1)
for 名, 句 in 屋里的话:
    for w in 古词 + 术语:
        if w in 句:
            错.append(f'{名} 里有「{w}」：{句[:30]} —— 屋里说的话也是屏上的字')

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    print('\n  规则：2026-08-30 用户定「完全不允许有任何文言古书的表达，'
          '只能是在命理分析中专业细节中有」')
    sys.exit(1)
print(f'✓ {len(文件)} 屏 + 屋里村里 {len(屋里的话)} 句 + 库里 {len(库里的字)} 行都没有文言称谓，术语也只留在「那一份」里')
