#!/usr/bin/env python3
"""村民台词的规格。

四十位里只有几位开口说话，剩下的在自己屋里一言不发 —— 而「居民是主角」
是这一版的主线。台词一位一位地写（`20260828004_villager_line.sql` 开头
就交代了这条：一次写四十位，写出来的是四十句一个味儿的话）。

这一支守的是【写出来的那几条合不合规格】，不是「写了几位」：

  · 每位恰好四条，seq 是 1..4 —— 少一条会在轮播里露出空当
  · 短。超过 30 个字的不是台词是独白
  · 中文标点全角（项目规则第一条）
  · 结尾不加句号（非正式文本；问号叹号省略号照留）
  · 不许出现术语 —— 台词是这个人在说话，不是在报盘

判据落在迁移文件上，不连库：门禁要在没有 Postgres 的机器上也跑得动。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
迁移 = 根 / 'backend' / 'migrations'

术语 = ['日主', '用神', '格局', '藏干', '纳音', '印星', '比劫', '身强', '身弱',
        '流年', '大运', '十神', '旺衰']

# 【文言】。硬要求写着「完全不允许有任何文言古书的表达，只能在命理分析的
# 专业细节里」—— 台词是气泡，不是说明书。阿云说了两版「贫道不算命」，
# 门禁一路绿灯，最后靠人读出来（2026-09-01 五路评审）。
文言 = ['贫道', '老衲', '小生', '在下', '足下', '尔等', '汝', '吾', '岂',
        '矣', '哉', '焉', '乎也', '莫非', '何须', '不才', '愚以为']
# 【行话】。跟界面同一条规矩:说明书里可以，人嘴里不行。
# 阿云那句「起局要静」还错了门 —— 起局是奇门的说法，他会的是大六壬。
行话 = ['起局', '起课', '排盘', '本命盘', '大六壬', '奇门遁甲', '紫微斗数',
        '梅花易数', '藏历密算', '六爻', '八字', '卦象', '爻辞']

条 = re.compile(r"\(\s*'([a-z_]+)'\s*,\s*(\d+)\s*,\s*'((?:[^']|'')*)'\s*\)")
错, 人 = [], {}

文件 = sorted(迁移.glob('*villager_line*.sql')) + sorted(迁移.glob('*_lines.sql'))

# 【别漏文件】。上面靠文件名挑，起名没照规矩来的那一份就静默不参与 ——
# 而报出来是「11 位都合规格」，看着跟通过一模一样（2026-09-01 真踩到:
# 新写的八位起名叫 `..._lines_batch2.sql`，`*_lines.sql` 匹配不上）。
# 判据是【目录里凡是插 villager_line 的文件，都得在名单里】。
漏 = [f for f in sorted(迁移.glob('*.sql'))
      if 'INSERT INTO villager_line' in f.read_text(encoding='utf-8') and f not in 文件]
if 漏:
    print('✗ 这几份插了台词却没被扫到（文件名得含 villager_line 或以 _lines.sql 结尾）：')
    for f in 漏:
        print('    ' + f.name)
    sys.exit(1)
if not 文件:
    print('✗ 找不到台词迁移 —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)

# 【UPDATE 也要读】。台词改错了不是重写整份迁移，是补一支
# `UPDATE villager_line SET text=...` —— 已经跑过的迁移不能再动
# （sqlx 记了校验和）。而这一支原先只读 INSERT，于是库里改过之后，
# 它读到的还是【旧文本】:改好的报错、改坏的报绿，两头都不对。
# 2026-09-01 修阿云那两句时当场撞上。按文件名顺序，后面的覆盖前面的 ——
# 跟数据库真正发生的事一致。
# 两种写法都要认。`AND seq = N` 是按位置改;`AND text LIKE '旧话%'`
# 是按旧文本改 —— 后者更早就在用了（20260830009 把沈砚的三句文言换掉），
# 而只认前一种的话，那一份就整份读不到:门禁会照着【被改掉的旧文本】
# 报错，人去看库却是好的，于是这一支从可信变成噪音。
覆盖 = re.compile(
    r"UPDATE\s+villager_line\s+SET\s+text\s*=\s*'((?:[^']|'')*)'"
    r"\s*\n?\s*WHERE\s+villager_id\s*=\s*'([a-z_]+)'\s+AND\s+"
    r"(?:seq\s*=\s*(\d+)|text\s+LIKE\s*'((?:[^']|'')*)')", re.I)
覆盖文件 = sorted(f for f in 迁移.glob('*.sql')
                  if 'UPDATE villager_line' in f.read_text(encoding='utf-8'))

for f in 文件:
    s = f.read_text(encoding='utf-8')
    # 只看 INSERT 进 villager_line 的那些段
    # 段尾用【半角分号】断 —— `[^;]+` 会被注释里的全角分号「；」截断:
    # 2026-08-31 加五位的时候正好踩到，整个文件只解析出头 265 个字符，
    # 门禁照样报绿，而它其实一条都没读到。空解析长得跟「全都合规」一样。
    for 段 in re.findall(r'INSERT INTO villager_line.*?\n\s*ON CONFLICT[^;]*;', s, re.S):
        for who, seq, text in 条.findall(段):
            人.setdefault(who, {})[int(seq)] = (text.replace("''", "'"), f.name)

for f in 覆盖文件:
    for text, who, seq, 旧话 in 覆盖.findall(f.read_text(encoding='utf-8')):
        新话 = text.replace("''", "'")
        条们 = 人.get(who, {})
        if seq:
            打中 = [int(seq)] if int(seq) in 条们 else []
        else:
            前缀 = 旧话.replace("''", "'").rstrip('%')
            打中 = [n for n, (t, _) in 条们.items() if t.startswith(前缀)]
        if not 打中:
            # 打空了的 UPDATE 在库里是静默无事发生 —— 最难发现的那种错:
            # 台词没改成，而门禁与库各说各话
            标的 = f'#{seq}' if seq else f'「{旧话}」'
            错.append(f'{f.name} 改的是 {who}{标的}，可现有台词里没这一条 —— 这句改动落空了')
            continue
        for n in 打中:
            人[who][n] = (新话, f'{条们[n][1]} → {f.name}')

for who, 条们 in sorted(人.items()):
    for seq, (t, 出处) in sorted(条们.items()):
        标 = f'{出处} · {who}#{seq}'
        if len(t) > 30:
            错.append(f'{标} 太长（{len(t)} 字）—— 台词不是独白：{t[:20]}…')
        if re.search(r'[一-龥][,?!;:]|[,?!;:][一-龥]', t):
            错.append(f'{标} 半角标点：{t}')
        if t.endswith('。'):
            错.append(f'{标} 结尾带句号 —— 非正式文本不加：{t}')
        for 词 in 术语:
            if 词 in t:
                错.append(f'{标} 出现术语「{词}」—— 台词是他在说话，不是报盘：{t}')
        for 词 in 文言:
            if 词 in t:
                错.append(f'{标} 文言「{词}」—— 气泡里不许有文言，硬要求：{t}')
        for 词 in 行话:
            if 词 in t:
                错.append(f'{标} 行话「{词}」—— 说明书里可以，人嘴里不行：{t}')

for who, 条们 in sorted(人.items()):
    if sorted(条们) != [1, 2, 3, 4]:
        错.append(f'{who} 的 seq 不是 1..4，是 {sorted(条们)} —— 轮播会露空当')

# ── 演法别趋同 ──────────────────────────────────────────────
# 四十位最大的风险不是写得差，是写到第二十位时全变成一个人:
# 缺的东西各不相同，演法却是同一种。
#
# 阿罗（缺胆）的怯长在断句和单音里 —— 省略号、半截句。那一招对他
# 天然成立，因为句法残缺跟怯懦几乎同构;换个人就不成立:缺畏的老渔夫
# 句子极完整、极笃定，他的缺口长在过度自信里，不在句法里。
#
# 真正的检验是「把四十位洗牌抹掉名字，抽一条认不出是谁的就回炉」，
# 那条机器判不了。这里判它的影子:同一种句法招式被几个人共用。
招式 = {
    '省略号': lambda t: '……' in t,
    '结巴（顿号夹在字中间）': lambda t: re.search(r'[一-龥]、[一-龥](?![、一-龥]{2,})', t) is not None,
    '破折号转折': lambda t: ' —— ' in t,
}
for 名, 判 in 招式.items():
    用的人 = sorted(w for w, cs in 人.items() if sum(1 for t, _ in cs.values() if 判(t)) >= 2)
    # 一个人四条里用两次以上算「这是他的招式」;三个人以上共用就是趋同
    if len(用的人) >= 3:
        错.append(f'「{名}」这一招 {len(用的人)} 个人在用（{"、".join(用的人)}）'
                  f' —— 演法在趋同，缺的东西不一样，说话的形状就该不一样')

# 【解析装置自检】。文件在、却一条都没抠出来时，上面每一条规则都是空转，
# 而报出来的是「全都合规」——空解析长得跟通过一模一样（2026-08-31 真踩到）。
# 所以拿文件里的 seq 出现次数当旁证:它跟解析出来的条数必须对得上。
应有 = sum(len(re.findall(r"\(\s*'[a-z_]+'\s*,\s*\d+\s*,\s*'", f.read_text(encoding='utf-8')))
         for f in 文件)
实得 = sum(len(c) for c in 人.values())
if 应有 != 实得:
    print(f'✗ 解析漏了:文件里有 {应有} 条，只抠出 {实得} 条 —— 这一支在空转')
    sys.exit(1)

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print(f'✓ {len(人)} 位的台词都合规格（各四条 · 短 · 全角 · 不报盘）')
