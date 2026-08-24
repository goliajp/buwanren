#!/usr/bin/env python3
"""本机门禁跑的每一支，CI 里也得跑 —— 跑不了的要写明为什么。

2026-08-19 普查 41 项门禁，查出三支**只在本机跑**：
`check-reachable-pages`（页面走不走得到）、`check-error-leak`（报错原文
会不会进响应体）、`browser-smoke`（通知条真浏览器）。
CI 不跑的门禁，谁不跑 `gates.sh` 就能绕过去，而绕过去的人不会知道自己绕了。

判据：`scripts/gates.sh` 里每一条 `gate` 的命令，都要能在
`.github/workflows/*.yml` 里找到痕迹；找不到的，必须在
`scripts/gates-not-in-ci.json` 里记着**并写明理由**。
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> int:
    gates = (ROOT / 'scripts/gates.sh').read_text(encoding='utf-8')
    rows = re.findall(r'^\s*gate\s+"([^"]+)"\s+\S+\s+(.+)$', gates, re.M)
    if not rows:
        print('✗ gates.sh 里一条 gate 都没解析出来 —— 它的写法变了？这一步没法判。',
              file=sys.stderr)
        return 2

    # 只看 `run:` 里跑的命令。整份 yml 拿来 grep 的话，
    # **`paths:` 过滤里提到也算数** —— 而「改了它会触发这条 workflow」
    # 跟「这条 workflow 会跑它」是两回事。
    # 2026-08-19 第一版就是这么写的：把 `run:` 换成 `true` 之后它照样绿。
    runs = []
    for f in (ROOT / '.github/workflows').glob('*.yml'):
        for line in f.read_text(encoding='utf-8').split('\n'):
            m = re.match(r'\s*(?:-\s*)?run:\s*(.*)$', line)
            if m:
                runs.append(m.group(1))
                continue
            # `run: |` 之后的续行也算 —— 多行脚本里常有真正跑的那一句
            if line.startswith(' ' * 10) and line.strip():
                runs.append(line.strip())
    wf = '\n'.join(runs)
    if not wf:
        print('✗ 一个 workflow 的 run 都没读到 —— 这一步没法判。', file=sys.stderr)
        return 2

    known = json.loads((ROOT / 'scripts/gates-not-in-ci.json').read_text(encoding='utf-8'))
    在册的 = known['本机独有']

    缺理由 = [k for k, v in 在册的.items() if not str(v).strip()]
    if 缺理由:
        print('✗ 这几支记在「本机独有」里却没写理由：' + '、'.join(缺理由), file=sys.stderr)
        return 1

    未进CI = []
    for name, cmd in rows:
        # 从命令里取一个能在 yml 里找到的记号
        m = (re.search(r'(scripts/[\w.-]+)', cmd)
             or re.search(r'(cargo \w+|npm run \w+|npx tsc|docker compose \w+)', cmd))
        key = m.group(1) if m else None
        if key is None:
            # 取不出记号就不判它 —— 猜一个记号去判，红了也指不出是哪儿
            continue
        if key not in wf and name not in 在册的:
            未进CI.append(f'{name}　（{key}）')

    多余的 = [k for k in 在册的 if not any(k == n for n, _ in rows)]
    if 多余的:
        print('✗ 「本机独有」里这几支已经不在 gates.sh 里了，删掉：' + '、'.join(多余的),
              file=sys.stderr)
        return 1
    if 未进CI:
        print('✗ 这几支门禁 CI 里不跑，也没记在 scripts/gates-not-in-ci.json 里：',
              file=sys.stderr)
        for x in 未进CI:
            print('    ' + x, file=sys.stderr)
        print('  要么加进某条 workflow，要么记一笔并写明为什么跑不了。', file=sys.stderr)
        return 1

    print(f'✓ {len(rows)} 支门禁，CI 里都跑'
          f'（另有 {len(在册的)} 支本机独有，各自记着原因）')
    return 0


sys.exit(main())
