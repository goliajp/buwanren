#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 art.mingli_leaf 填的都是 mingli 真有的叶。

写第一版映射时我填了 `rune` 与 `luoshu`：前者 mingli 根本没有这片叶，
后者有 crate 但没登记进 registry。两条都是照着「听起来该有」写的。

填错的下场不是报错，是 `fetch_chart` 拿不到盘、静静落一个空盘 ——
看起来跟「这门术数还没接算力」一模一样。所以要有人机械地核一遍。

用法：python3 scripts/check-art-leaf.py [mingli 仓库路径]
      默认 ~/workspace/goliajp/mingli；仓库不在就跳过并说明（不是失败）。

**它读的是旁边那个仓库的【工作区】，不是某个发布版本** —— 所以那边
有人正在改的时候，它会如实报出那一秒的事实。2026-08-30 撞上一次：
它报「ziwei 指向不存在的叶」，几分钟后自己就绿了（登记的叶 23 → 24），
因为 mingli 那边正把 ZiweiEngine 那一行改来改去。
红得没错，只是那不是本仓的问题 —— 判据是「重跑之前先看一眼
`git -C ~/workspace/goliajp/mingli status`」，那边不干净就等它安定。

**这一支不进 CI**：它要旁边的 mingli 仓库，而 CI 里没有，跑起来永远是「跳过」——
一条永远跳过的核对就是一条永远绿的核对，比没有更糟，它会让人以为这件事有人管。
改动 `backend/seed/art_leaf.sql` 时在本机跑一遍。
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MINGLI = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'workspace/goliajp/mingli'
SEED = ROOT / 'backend/seed/art_leaf.sql'


def registered_leaves(mingli: Path):
    """registry() 里登记的叶 → 它们各自 CastingEngine::id() 报的 key。"""
    reg = mingli / 'crates/mingli-registry/src/lib.rs'
    crates = sorted(set(re.findall(r'mingli_([a-z]+)::\w+Engine', reg.read_text(encoding='utf-8'))))
    ids = set()
    for c in crates:
        src = mingli / f'crates/mingli-{c}/src'
        if not src.is_dir():
            print(f'  ⚠ registry 登记了 mingli-{c}，但找不到它的源码', file=sys.stderr)
            continue
        blob = '\n'.join(f.read_text(encoding='utf-8') for f in src.rglob('*.rs'))
        m = re.search(r'fn id\(&self\) -> &\'static str \{\s*"([a-z_]+)"', blob)
        if m:
            ids.add(m.group(1))
        else:
            print(f'  ⚠ mingli-{c} 没有 fn id()', file=sys.stderr)
    return ids


def main():
    if not (MINGLI / 'crates/mingli-registry/src/lib.rs').is_file():
        print(f'· 本机没有 mingli 仓库（{MINGLI}），跳过校验')
        print('  这不是失败 —— 但也就没人替你核过叶名。有仓库的机器上跑一次。')
        return 0

    leaves = registered_leaves(MINGLI)
    if not leaves:
        # 读不出叶名时**不许去判 seed** —— 那样 18 条映射会全部被判成
        # 「指向不存在的叶」，报错指向产品，而错在读的这一侧。
        # 2026-08-18 同一个形状在别处栽了三次（psql 连不上却照样打分、
        # `--quick` 跳过变异测试、等待循环根本没等）。
        print(f'✗ 从 mingli registry 里一片叶都没解析出来（{MINGLI}）—— 它的格式变了？',
              file=sys.stderr)
        print('  这一步没法判 seed 对不对，所以直接失败，不去指控那 18 条映射。',
              file=sys.stderr)
        return 2
    used = dict(re.findall(r"\('([a-z_]+)',\s*'([a-z_]+)'\)", SEED.read_text(encoding='utf-8')))
    if not used:
        print('✗ 从 seed 里一条映射都没解析出来 —— 格式变了？', file=sys.stderr)
        return 2

    bad = {a: l for a, l in used.items() if l not in leaves}
    print(f'mingli 登记了 {len(leaves)} 片叶；seed 里映射了 {len(used)} 门术数')
    if bad:
        print(f'\n✗ {len(bad)} 条指向不存在的叶：')
        for a, l in sorted(bad.items()):
            print(f'    {a} → {l}')
        print('  可用的叶：' + ' '.join(sorted(leaves)))
        return 1
    print('✓ 每一条都指向真实存在的叶')
    return 0


if __name__ == '__main__':
    sys.exit(main())
