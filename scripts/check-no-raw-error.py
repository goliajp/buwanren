#!/usr/bin/env python3
"""技术原文不许上屏。

后端的错误串是写给排查的人看的:`not found: product`、
`validation: qty -1 ≤ 0`、`not found: 没有这枚护身符：qr/没这串字`。
把它原样摆到屏上，用户读到的是一句看不懂、也说不出下一步的话。

`utils/say.ts` 负责把它换成人话。这一支盯两件事:

  1. **`say.ts` 自己不许靠「有没有汉字」判断**。
     那条判据在【用户自己输的字被回显进错误串】时当场失效 ——
     实测 `POST /v1/orders {"sku_id":"没这个"}` 回的是
     `not found: sku 没这个`，而这个 app 里用户输的东西全是中文，
     所以那不是边角情况，是常态。判据要用后端明确给的 `code`。

  2. **别处不许绕过它**。`setData({ 某某: e.message })` 这种写法
     等于自己开一条路把原文送上屏。诊断要原文就写进 `console`。

判据是机械的:页面与 utils 的 .ts 里，`.message` 出现在
`setData(...)`／模板串／赋给某个 data 字段的位置 —— 红。
出现在 `console.*` 里 —— 放过。
"""
import re, sys, pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
say = 根 / 'mini/miniprogram/utils/say.ts'
错 = []

if not say.exists():
    print('✗ 找不到 utils/say.ts —— 这一支够不着要验的东西'); sys.exit(1)
s = say.read_text(encoding='utf-8')
无注释 = re.sub(r'/\*.*?\*/|//[^\n]*', '', s, flags=re.S)
if re.search(r'\[一-龥\]', 无注释):
    错.append('utils/say.ts 还在用「有没有汉字」当判据 —— 用户输入被回显时它会把整句原文推上屏')
if 'code' not in 无注释:
    错.append('utils/say.ts 没有用后端给的 code 分类 —— 那是唯一不用猜的判据')

文件 = sorted((根 / 'mini/miniprogram/pages').glob('*/index.ts')) \
     + sorted((根 / 'mini/miniprogram/utils').glob('*.ts')) \
     + sorted((根 / 'mini/miniprogram/services').glob('*.ts'))
查过 = 0
for f in 文件:
    if f.name == 'say.ts':
        continue                      # 它就是干这个的
    t = f.read_text(encoding='utf-8')
    t = re.sub(r'/\*.*?\*/|//[^\n]*', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), t, flags=re.S)
    for i, 行 in enumerate(t.splitlines(), 1):
        # 【别要求 `.message` 前面是个标识符】。`(e as ApiError).message` 前面
        # 是一个右括号 —— 上一版的 `\b\w*…\.message` 认不出它，
        # 而那正是变异测试当场打不中的那一发（2026-09-02）。
        if not re.search(r'\.message\b', 行):
            continue
        # 【只看【读】，不看【写】】。`c.message = 留言.trim()` 里那个 message
        # 是用户留的话，字段就叫这个名 —— 跟错误原文毫无关系。
        # 不分读写的话这一支第一次跑就误报了它（2026-09-02）。
        if re.search(r'\.message\s*=[^=]', 行):
            continue
        查过 += 1
        if re.search(r'console\.\s*(?:warn|error|log|info)', 行):
            continue                  # 进控制台是对的:原文不丢，只是不摆脸上
        # `services/api.ts` 是造 ApiError 的地方，那儿要读 message 组对象
        if f.name == 'api.ts':
            continue
        错.append(f'{f.relative_to(根)}:{i}　把技术原文往屏上送：{行.strip()[:76]}'
                  f'\n      要显示就走 `一句(e)`；要留原文就写 console')

if 查过 < 3:
    print(f'✗ 只扫到 {查过} 处 `.message` —— 这一支多半在空转'); sys.exit(1)
for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'技术原文不上屏 · 查了 {查过} 处 `.message`')
sys.exit(1 if 错 else 0)
