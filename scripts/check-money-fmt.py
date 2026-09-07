#!/usr/bin/env python3
"""金额只许有一支格式化。

商品屏自己抄了一份 `money()`，于是同一个 9900 在商品屏上写作「¥99.00」、
在确认屏上写作「¥99」—— 改了 utils 那一份只动了后者，两屏当场说两种话。
抄一份的代价不是多十行，是它会漂，而且漂在标价上。

判据：`mini/miniprogram/` 里除了 `utils/money.ts`，不许再出现
把「分」拼成货币串的那套写法（`Math.floor(x / 100) + '.'` 之类）。
后端同一件事在 `unmei_domain::commerce::money::Money::display_human`
（`ai_compose::money_display` 是它的门面），两边规矩要一样 ——
这一支顺带核对它俩对整数金额的处理没有分家。

【2026-09-07 搬过一次家】。那一支原先整份长在 `unmei-api::ai_compose` 里，
而 `unmei-app` 在下一层够不着 —— 于是 `coupon.rs` 要说「要满 ¥49 才能用」时
自己又拼了一份（这一支当场抓住）。判据跟着搬到领域层:
**唯一那一支在哪儿，这里就盯哪儿**，不然它盯的是一个空壳。
"""
import re
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
前端 = 根 / 'mini/miniprogram'
唯一 = 前端 / 'utils/money.ts'

错 = []

if not 唯一.is_file():
    print('✗ 找不到 utils/money.ts —— 这一支够不着要验的东西，不算通过')
    sys.exit(1)

# 分 → 元的拼法。
# 【一种形状不够】。第一版只认「除以 100 之后拼小数点」，而 2026-09-01
# 名册 / 订阅 / 村民三块屏各自抄了一份 `(分/100).toFixed(2)` —— 三处全逃掉。
# 它们跟 `money()` 有两处真分歧:非 CNY 一个符号都不写，而 JPY 还会被
# 多除一次 100（日元没有分）。库里 region=cn 有 202 个 sku 同时挂着
# CNY 与 JPY 的在售价，谁赢由生效时间定 —— 显示什么币种是数据说了算。
# （2026-09-01 五路评审 · 工程审计。）
拼法 = re.compile(
    r'/\s*100\s*\)?\s*\+\s*[\'"]\.'          # 除以 100 再拼小数点
    r'|/\s*100\s*\)\s*\.toFixed\s*\('           # (分 / 100).toFixed(…)
    r'|toFixed\s*\(\s*2\s*\)'                    # 任何 toFixed(2) —— 金额之外用不到它
)
for f in sorted(前端.rglob('*.ts')):
    if f == 唯一:
        continue
    s = f.read_text(encoding='utf-8')
    # 【先剥注释】。注释里讨论「原先自己抄了一份 /100 + toFixed(2)」是允许的 ——
    # 不剥的话，写下这条改动记录的那一行会把门禁自己绊倒
    # （2026-09-01 当场发生）。跟 check-seed-overwrites 那次是同一个形状。
    s = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), s, flags=re.S)
    s = re.sub(r'//[^\n]*', lambda m: ' ' * len(m.group(0)), s)
    if 拼法.search(s):
        错.append(f'{f.relative_to(根)} 自己拼了一份金额格式 —— 用 utils/money.ts 那支')

# 两边对【整数金额】的处理要一致：都不挂零头
前 = 唯一.read_text(encoding='utf-8')
唯一后端 = 根 / 'backend/unmei-domain/src/commerce/money.rs'
if not 唯一后端.is_file():
    print('✗ 找不到 unmei-domain 的 money.rs —— 后端那一半在空转，不算通过')
    sys.exit(1)
后 = 唯一后端.read_text(encoding='utf-8')
前不挂 = '分 === 0' in 前
# 后端那一支的判据是「零头是零就把它切掉」（`display_human`）
后不挂 = '% pow == 0' in 后
if 前不挂 != 后不挂:
    错.append(f'前后端对整数金额说法不一致（前端不挂零头={前不挂} / 后端={后不挂}）')

# 【后端也不止一支】。这一支的文档注释说「后端同一件事在
# `ai_compose::money_display`，两边规矩要一样」，而实现只比对了一个布尔量，
# 根本没扫后端有没有第二支。`activity.rs` 就有一处
# `format!("¥{}", price_cn / 100)` —— 整数除法截断（9950 → ¥99，少收五十），
# 还硬写 ¥（2026-09-01 五路评审 · 工程审计）。
后端 = 根 / 'backend'
后拼法 = re.compile(r'format!\(\s*"[^"]*[¥$€£][^"]*"\s*,[^)]*/\s*100')
扫过后端 = 0
for f in sorted(后端.rglob('*.rs')):
    # 唯一那一支自己当然在拼金额。门面那一层只是转调，也不必扫。
    if 'target' in f.parts or f in (唯一后端,) or f.name == 'ai_compose.rs':
        continue
    src = f.read_text(encoding='utf-8')
    src = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), src, flags=re.S)
    src = re.sub(r'//[^\n]*', lambda m: ' ' * len(m.group(0)), src)
    扫过后端 += 1
    if 后拼法.search(src):
        错.append(f'{f.relative_to(根)} 自己拼了一份金额格式 —— '
                  f'用 ai_compose::money_display 那支（它按币种定小数位，不截断）')
if 扫过后端 < 20:
    print(f'✗ 后端只扫到 {扫过后端} 个 .rs —— 这一半在空转')
    sys.exit(1)

if 错:
    print('\n'.join('✗ ' + e for e in 错))
    sys.exit(1)
print('✓ 金额只有一支格式化，前后端说法一致')
