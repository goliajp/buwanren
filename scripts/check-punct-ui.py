#!/usr/bin/env python3
"""面向人的中文标点必须全角 —— 这一支要求【零】，不是记账。

`check-punct.py` 扫的是文档，用的是「存量记账、增量不许涨」，因为那两千多处
是历史欠账，一次改完是个巨大又低价值的 diff。

**产品自己的文案不一样**：它数量少、是用户真会看见的东西，而项目第一条规则
说的就是它。所以这一支要求零违规，不设基准。

（这道口子是 2026-08-18 从一张截图里发现的：今日页上明晃晃写着
「「缺」是长期结构,不是一天的运」——半角逗号，而当时的门禁只扫 .md，
产品文案一处也没管。）

扫哪些：
  · `.wxml` 里【会显示出来的】文字：标签之间的文本、属性里的中文串
  · `.ts` 里的字符串字面量（toast / modal / 显示在页面上的 err 文案都在这里）

**按词法走，不靠引号配对**。`木: 'mu', 火: 'huo'` 这种行，按奇偶配对会把两个
字符串【之间】的代码 `, 火: ` 当成字符串内容报出来 —— 那是假阳性，
而假阳性会让人开始忽略门禁。

用法:
  python3 scripts/check-punct-ui.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
UI = ROOT / 'mini/miniprogram'
# 后台也是【界面文案】。它是内部工具,但看的仍然是人,规则一样
ADMIN = ROOT / 'webadmin/src'
# 种子里的文案。用户读得最多的那些字 —— 签的判词、门解、引言、每个「缺」的那一句
# —— 都不在源码里,在这儿。2026-08-18 之前这一片没人扫:落卦那一屏上
# 「至人无己,神人无功,圣人无名。」的逗号是半角的,而它是从截图上看见的。
SEED = ROOT / 'backend/seed'
# 工具脚本【打到终端上】的中文。看的也是人，规则一样 —— 2026-08-18 我自己
# 往 dev-all.sh 里写了十处半角才发现：这一层谁都没管，而它是每天都在读的字。
# 只取 echo / printf / print / console.log 的字面量；注释不取（存量 600+，
# 那是另一次决定，见 check-punct.py 里「源码注释暂不扫」那句）。
# printf 是补的：头一版漏了它，于是门禁报绿、而 ci-status.sh 每次打出来的
# 「没动过,结论仍成立」一直是半角 —— 报绿而字是错的，是最坏的那种绿。
TOOLS = [ROOT / 'scripts', ROOT / 'web']
# 变异测试脚本【故意】含半角标点 —— 它们把坏标点种进副本，用来验这一支
# 抓不抓得住。改「好」了，变异测试就不再测任何东西。
SKIP_FILES = {'mutationtest-checks.sh', 'mutationtest-sql.sh', 'mutationtest.sh'}
# 村子自己的字：台词、气泡、地块说明。这是全仓最大的一片中文，
# 3183 条字面量，而在 2026-08-18 之前三支标点门禁没有一支够得着它
# （文档那支只扫 .md，界面那支只扫 mini/ 与 webadmin/）。
# 扫【源码树】不扫 design.html —— 后者是产物，直接改它由 build --check 拦。
ROOMSRC = ROOT / 'rooms/src'
# 后端里的中文串：返回给用户的报错、日志、测试断言。头两类分别是产品文案与
# 终端上的字，第三类是给人读的失败说明 —— 都在这条规则里。
# 【SQL 不算】：`VALUES ($1,'测试')` 这种括号是代码，规则明确豁免。
# 这不是理论问题 —— 2026-08-18 我先按普通文本改了一遍，把 SQL 的括号换成
# 全角，Postgres 当场 42601，七条测试全红。
BACKEND = ROOT / 'backend'
# 迁移里的文案。种子扫了、迁移没扫 —— 而改版时新文案多半写在迁移里
MIGRATIONS = ROOT / 'backend/migrations'

CJK = r'一-龥'
BAD = re.compile(rf'[{CJK}][,?!;:]|[,?!;:][{CJK}]')

# 括号另判。规则表里写着 `()` → `（）`，但规则自带的那条正则只管 `,?!;:`，
# 所以这里给一条**同样机械**的判据：**括号里含汉字**就算中文内容里的括号。
#
# 这样 `(+8)`、`(control plane)` 自动豁免 —— 规则本来就豁免数字表达式与代码，
# 而「括号里是中文」不需要任何人拿捏。
# (2026-08-18 从问签页的截图里看见的:「想问什么(可空 · 只给你自己看)」。)
PAREN = re.compile(rf'\([^()]*[{CJK}][^()]*\)')


def ts_strings(src):
    """走一遍 .ts,把字符串字面量的【内容】挑出来。

    要处理的:三种引号、转义、行注释、块注释、模板串里的 ${} 是代码不是文字。
    注释不算界面文案 —— 中文注释另有规矩,不归这支管。"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            i = src.find('\n', i)
            if i < 0:
                break
        elif c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
        elif c in '\'"`':
            q, i, buf = c, i + 1, []
            while i < n:
                if src[i] == '\\':
                    i += 2
                    continue
                if src[i] == q:
                    i += 1
                    break
                if q == '`' and src[i] == '$' and i + 1 < n and src[i + 1] == '{':
                    depth, i = 1, i + 2      # ${} 里是代码,跳过
                    while i < n and depth:
                        depth += (src[i] == '{') - (src[i] == '}')
                        i += 1
                    continue
                buf.append(src[i])
                i += 1
            out.append(''.join(buf))
        else:
            i += 1
    return out


SQLISH = re.compile(r'^\s*(INSERT|SELECT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|SET)\b', re.I)


def rust_strings(src):
    """`.rs` 里的双引号字面量。行注释跳过；看着像 SQL 的跳过（那是代码）。"""
    out = []
    for line in src.split('\n'):
        if line.strip().startswith('//'):
            continue
        for t in re.findall(r'"([^"\n]{1,300})"', line):
            if SQLISH.match(t) or '$1' in t:
                continue
            out.append(t)
    return out


def printed_strings(src, shellish=False):
    """脚本里会打到终端的中文。整行是注释就跳过 —— 注释不在这一支的范围里。

    取两种：`echo` / `printf` / `print` / `console.log` 后面紧跟的字面量，
    以及【传给自定义函数的】中文串（只在 shell 里）—— `skip` 的第二个参数这种。
    后者是补的：头两版只认前者，于是 gates.sh 每次打出来的四条跳过消息
    都带着半角逗号，而门禁一路报绿。凡是含汉字的双引号串都算给人看的字。
    """
    out = []
    for line in src.split('\n'):
        t = line.strip()
        if t.startswith('#') or t.startswith('//') or t.startswith('*'):
            continue
        for m in re.finditer(r"""(?:echo|printf|print|console\.log)\s*\(?\s*(['"`])(.*?)\1""", line):
            out.append(m.group(2))
        if shellish:
            # 只对 shell 展开到「任意双引号串」。Python 的 docstring 也长这样，
            # 而 docstring 是注释性质 —— 收进来就等于把注释也扫了。
            for m in re.finditer(r'"([^"\n]{1,300})"', line):
                if re.search(rf'[{CJK}]', m.group(1)):
                    out.append(m.group(1))
    return out


def wxml_text(src):
    """.wxml 里会显示出来的部分:标签之间的文字 + 属性里的中文串。
    注释与 {{ }} 表达式剔掉 —— 后者是代码。"""
    src = re.sub(r'<!--[\s\S]*?-->', '', src)
    src = re.sub(r'\{\{[^}]*\}\}', '', src)
    return re.findall(r'>([^<>]+)<', src) + re.findall(r'"([^"<>]*)"', src)


def jsx_text(src):
    """`.tsx` 里标签之间的文字。取法【保守】:必须含汉字,且不含 { } = ; < >
    这几个几乎一定是代码的字符 —— 宁可漏,不可误报。
    一支会误报的门禁,人很快就开始无视它,那比没有它更糟。"""
    out = []
    for t in re.findall(r'>([^<>]+)<', src):
        if re.search(rf'[{CJK}]', t) and not re.search(r'[{}=;]', t):
            out.append(t)
    return out


def _有人提到(文: str, 这一份: pathlib.Path, 更晚: bool) -> bool:
    """别的迁移里有没有提到这一串字的某一段。

    取【五字滑窗】而不是固定前缀:改文案的那一版写 `LIKE '%当下问事起卦%'`，
    它含的是原句中间的一段，固定取前八个字就对不上 —— 而对不上时
    这一支会把一条已经改掉的旧文案继续报红，人只好去豁免它，
    豁免一开口子就再也关不上了。
    """
    文 = 文.strip().strip('%')
    if len(文) < 5:
        return False
    窗 = {文[i:i + 5] for i in range(len(文) - 4)}
    for f in sorted(MIGRATIONS.glob('*.sql')):
        if (f.name <= 这一份.name) if 更晚 else (f.name >= 这一份.name):
            continue
        文本 = f.read_text(encoding='utf-8')
        if any(w in 文本 for w in 窗):
            return True
    return False


def 被后面覆盖过(文: str, 这一份: pathlib.Path) -> bool:
    """这条旧文案有没有被【后面某一版迁移】改掉。

    历史迁移不能编辑:sqlx 校验的是文件内容的哈希，动一个字，
    所有现存库启动时就对不上。可也不能因此一律豁免 ——
    那等于说「写进迁移里的文案永远不用管」。

    所以要证据:后面某一版迁移里出现了这条旧文案的一段（多半在
    `WHERE ... LIKE '%…%'` 里），就说明它已经被换掉了，放行;
    找不到就照旧报红。判据落在【文件里看得见的东西】上，不查库 ——
    这一支在没有 Postgres 的机器上也要能跑。
    """
    return _有人提到(文, 这一份, 更晚=True)


def 引用了旧文案(文: str, 这一份: pathlib.Path) -> bool:
    """这串字是不是在【引用】更早的旧文案（`LIKE '%…%'` 或 `replace()` 的第一参）。

    改旧文案的迁移必须把旧句子原样写进 WHERE 里才找得到它，
    于是那半角标点是【必须保留的】—— 改「好」了就匹配不上，这一版等于没跑。
    判据同样落在文件上:这一段在更早的某一版里出现过，就是引用。
    """
    return _有人提到(文, 这一份, 更晚=False)


def 是注释语句(行: str) -> bool:
    """`COMMENT ON ... IS '…'` 是【写给开发者的】列注释，跟代码注释同类。

    这一支明确豁免注释（见 check-punct.py 里「源码注释暂不扫」那句），
    而 SQL 的注释恰好长得像字符串字面量 —— 不排掉就会把
    「首次请求的 HTTP 状态码;0 = 正在处理中」这种也算成产品文案。
    """
    return 'COMMENT ON' in 行.upper()


def sql_strings(src):
    """SQL 里的字符串字面量。`''` 是转义的单引号,不是结束。
    行注释里的不算文案;`COMMENT ON` 那种列注释也不算（见 `是注释语句`）。"""
    src = re.sub(r'--[^\n]*', '', src)
    # 按【语句】切，不按行 —— `COMMENT ON COLUMN x IS` 与那串字常常跨行，
    # 按行判会把 IS 后面那一行当成普通文案（真踩到过）
    src = ';'.join('' if 是注释语句(句) else 句 for 句 in src.split(';'))
    out, i, n = [], 0, len(src)
    while i < n:
        if src[i] != "'":
            i += 1
            continue
        j, buf = i + 1, []
        while j < n:
            if src[j] == "'" and src[j + 1:j + 2] == "'":
                buf.append("'"); j += 2; continue
            if src[j] == "'":
                break
            buf.append(src[j]); j += 1
        out.append(''.join(buf))
        i = j + 1
    return out


def scan():
    hits, seen = [], 0
    files = (list(UI.rglob('*.wxml')) + list(UI.rglob('*.ts'))
             + list(ADMIN.rglob('*.ts')) + list(ADMIN.rglob('*.tsx'))
             + list(SEED.glob('*.sql'))
             # 迁移里也有【面向用户的文案】。种子那一片 2026-08-18 就收进来了，
             # 而 migrations 一直没收 —— 2026-08-30 我把门解、宜忌、收尾句
             # 全改写进迁移，八个半角冒号一路走到屏幕上，这一支报的还是绿。
             # 判据跟种子那一片一样:只看单引号里的字面量，SQL 语法不碰。
             + list(MIGRATIONS.glob('*.sql')))
    files += sorted(ROOMSRC.rglob('*.js'))
    files += [f for f in BACKEND.rglob('*.rs') if 'target/' not in str(f)]
    for d in TOOLS:
        for ext in ('*.sh', '*.py', '*.mjs'):
            files += [f for f in d.glob(ext)
                      if 'node_modules' not in str(f) and f.name not in SKIP_FILES]
    for f in sorted(files):
        seen += 1
        src = f.read_text(encoding='utf-8')
        if f.suffix == '.rs':
            parts = rust_strings(src)
        elif f.suffix == '.js':
            parts = ts_strings(src)
        elif f.suffix in ('.sh', '.py', '.mjs'):
            parts = printed_strings(src, shellish=(f.suffix == '.sh'))
        elif f.suffix == '.sql':
            parts = sql_strings(src)
        elif f.suffix == '.wxml':
            parts = wxml_text(src)
        elif f.suffix == '.tsx':
            parts = ts_strings(src) + jsx_text(src)
        else:
            parts = ts_strings(src)
        是迁移 = f.parent == MIGRATIONS
        for t in parts:
            # 历史迁移里的旧文案:后面有版本改掉了它就放行（见 `被后面覆盖过`）
            if 是迁移 and (被后面覆盖过(t, f) or 引用了旧文案(t, f)):
                continue
            for m in BAD.finditer(t):
                hits.append((f.relative_to(ROOT), t.strip()[:56], m.group()))
            for m in PAREN.finditer(t):
                hits.append((f.relative_to(ROOT), t.strip()[:56], '半角括号 ' + m.group()[:20]))
    return hits, seen


hits, seen = scan()
if not seen:
    print('✗ 一个文件都没扫到 —— 路径对不上了？查不到东西的核对必须失败')
    sys.exit(1)

for f, txt, m in hits:
    print(f'✗ {f}　「{txt}」　{m if m.startswith("半角括号") else "用了半角 " + m}')

print()
print(f'界面文案 {seen} 个文件 · {len(hits)} 处半角标点')
if hits:
    print('✗ 界面文案的标点一律全角，见 .claude/CLAUDE.md 第一条')
    print('  这一支不记账：产品自己的文案不许有欠账')
    sys.exit(1)
print('✓ 干净')
