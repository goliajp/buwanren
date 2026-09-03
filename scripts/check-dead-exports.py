#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""跨 crate 导出了、而没有任何人调的东西。

【这是这一轮评审里反复遇到的那个形状】（2026-09-03 五路评审 · 架构审计）：
东西建好了，两头都没接上。`audit_log` 有表没写者、`is_banned` 有列
没读者、`coupon.batch_id` 读了从不写、`PeriodState` 声明了没有路走到、
`region_scope` 发了从不查、`activity_registration` 有表零引用零行、
`payment::outcome_payload` 导出了零调用方 —— 而每一处都编译得干干净净。

Rust 的 `dead_code` 看不见这一类：`pub` 的东西对编译器来说
「可能被外面用」，所以它一声不吭。而这个仓库里 unmei-app 的外面
就只有 unmei-api 与 unmei-admin-api 两个 crate，都在这棵树里 ——
「外面」是可以数清楚的。

判据：`unmei-app` / `unmei-domain` 里 `pub` 的函数，在**整个工作区**
（含所有 crate 的集成测试）里一次都没被调过。

【为什么不判「跨 crate 没人调」】——第一版是那么判的，报出 24 条，
而其中二十条是「同 crate 在用，只是 `pub` 开大了」。那是可见性的口味，
不是洞；混在一起报的话，真正的那四条就被淹掉了 ——
而一支报一堆噪音的门禁会被学着忽略，那比没有它更糟。
可见性另说：同 crate 只用的那些收窄成 `pub(crate)` 之后，
rustc 自己的 `dead_code` 就接管了，用不着门禁。

**不判该不该删**。零调用方有三种，只有第一种是问题：
  · 建好了没接上 —— 这一支要抓的
  · 给下一步准备的 —— 台账里写清楚等谁
  · 只在测试里用 —— 台账里写清楚
所以照 `check-admin-roles` 的规矩来，用台账：
  · 台账里记着的，仍然零调用 → 照旧（打印，不计失败）
  · 台账里的某条已经有人调了 → 红，那一条该划掉
  · 新出现一条零调用的导出 → 红，要么接上，要么写明在等什么
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKEND = ROOT / 'backend'
LEDGER = ROOT / 'scripts/dead-exports.json'

# 被查的 crate → 它的「外面」有哪些 crate
被查 = {
    'unmei-app': ['unmei-api', 'unmei-admin-api'],
    'unmei-domain': ['unmei-app', 'unmei-api', 'unmei-admin-api', 'unmei-wx'],
}

# `pub fn 名(` / `pub async fn 名(`。只看函数 —— 类型与常量的引用形态
# 太多（`impl`、`as`、泛型参数），按名字数会假阳性一片。
PUBFN = re.compile(r'^\s*pub (?:async )?fn ([a-zA-Z_一-鿿][\w一-鿿]*)\s*[(<]', re.M)


def 源码(crate: str, 只要测试=False):
    d = BACKEND / crate
    if not d.is_dir():
        return []
    out = []
    for f in d.rglob('*.rs'):
        if 'target' in f.parts:
            continue
        是测试 = 'tests' in f.parts or f.name.startswith('test')
        if 是测试 == 只要测试:
            out.append(f)
    return out


def 去注释(src: str) -> str:
    src = re.sub(r'/\*[\s\S]*?\*/', '', src)
    return re.sub(r'//[^\n]*', '', src)


台账 = json.loads(LEDGER.read_text(encoding='utf-8')) if LEDGER.exists() else {}
记着的 = 台账.get('零调用方的导出', {})

零调用, 该划掉, 查过 = [], [], 0
for crate, 外面 in 被查.items():
    文件们 = 源码(crate)
    if not 文件们:
        print(f'✗ {crate} 一个 .rs 都没找到 —— 这一支够不着要验的东西，不算通过',
              file=sys.stderr)
        sys.exit(1)

    # 外面那几个 crate 的全部源码（含它们的测试 —— 那也是真调用）
    外部码 = '\n'.join(
        去注释(f.read_text(encoding='utf-8'))
        for c in 外面 for f in 源码(c) + 源码(c, 只要测试=True)
    )
    # 本 crate 的集成测试单独算：只在测试里用的，属于第三种，台账里写明
    测试码 = '\n'.join(去注释(f.read_text(encoding='utf-8'))
                       for f in 源码(crate, 只要测试=True))
    # 本 crate 自己的源码 —— 同 crate 的调用也算「有人用」，
    # 它是可见性的问题（该收成 pub(crate)），不是「建好了没接上」
    本crate码 = '\n'.join(去注释(f.read_text(encoding='utf-8')) for f in 文件们)
    if not 外部码.strip():
        print(f'✗ {crate} 的「外面」一行源码都没读到 —— 判据的形状变了',
              file=sys.stderr)
        sys.exit(1)

    for f in 文件们:
        码 = 去注释(f.read_text(encoding='utf-8'))
        for 名 in PUBFN.findall(码):
            查过 += 1
            键 = f'{crate}::{f.stem}::{名}'
            外面用了 = re.search(r'\b' + re.escape(名) + r'\s*[(:]', 外部码) is not None
            测试用了 = re.search(r'\b' + re.escape(名) + r'\s*[(:]', 测试码) is not None
            # 同 crate 内的调用（把定义那一行本身剔掉，不然它自己算自己）
            自家码 = re.sub(r'pub (?:async )?fn ' + re.escape(名) + r'\b', '', 本crate码)
            自家用了 = re.search(r'\b' + re.escape(名) + r'\s*[(:]', 自家码) is not None
            用了 = 外面用了 or 测试用了 or 自家用了
            只在测试 = 测试用了 and not 外面用了 and not 自家用了
            if 用了:
                if 键 in 记着的:
                    该划掉.append(键)
            else:
                零调用.append((键, 只在测试))

if 查过 < 100:
    print(f'✗ 只找到 {查过} 个 pub 函数（该有好几百）—— '
          '这一支够不着要验的东西，不算通过', file=sys.stderr)
    sys.exit(1)

新出现 = [(k, t) for k, t in 零调用 if k not in 记着的]

for 键 in 该划掉:
    print(f'✗ {键}　台账说它没人调，而现在有人调了 —— '
          f'把这一条从 {LEDGER.name} 里划掉', file=sys.stderr)
for 键, 只在测试 in 新出现:
    尾 = '（只有测试在用）' if 只在测试 else ''
    print(f'✗ {键}　导出了，而整个工作区一个调用方都没有{尾}', file=sys.stderr)

if 该划掉 or 新出现:
    print(f'  建好了两头没接上，是这个仓库里最常见的一种洞 —— '
          f'编译器看不见它（pub 对它来说「可能被外面用」）。', file=sys.stderr)
    print(f'  要么接上，要么记进 {LEDGER.name} 并写清在等什么。', file=sys.stderr)
    sys.exit(1)

print(f'✓ {查过} 个 pub 函数 · 一个调用方都没有的 {len(零调用)} 个都在台账上')
