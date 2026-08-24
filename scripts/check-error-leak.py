#!/usr/bin/env python3
"""外部库的报错原文，不许进响应体。

`impl IntoResponse for ApiError` 发出去的就是 `AppError` 的 Display。
所以 `From<sqlx::Error>` 那种转换里写 `AppError::Internal(format!("db: {e}"))`
等于把数据库原文公开：表名、约束名，有时还有值。

2026-08-19 实测：删掉本命之后起卦，客户端收到的是
`insert or update on table "naji_record" violates foreign key constraint
"naji_record_natal_id_fkey"`。那一行对排查的人有用，对拿到它的人也一样有用。

判据：一段 `From<某::Error>` 的转换体里，构造的必须是 `AppError::Infra`
（Display 是固定的 `internal error`，原文由 `AppError::detail()` 交给日志）。
自己写的 500 用 `AppError::Internal` 不受这条管 —— 那种消息是特意讲给
调用方听的，例如 `no published quote for locale "en"`。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FOREIGN = ('sqlx::Error', 'reqwest::Error', 'serde_json::Error')


def main() -> int:
    files = [f for f in (ROOT / 'backend').rglob('*.rs') if 'target' not in f.parts]
    if not files:
        print('✗ 一个 .rs 都没扫到 —— 查不到东西的核对必须失败', file=sys.stderr)
        return 2

    bad, checked = [], 0
    for f in files:
        src = f.read_text(encoding='utf-8')
        for m in re.finditer(r'impl From<(' + '|'.join(re.escape(x) for x in FOREIGN) + r')> for \w+',
                             src):
            # 从 impl 开头到下一个 `impl ` 或文件末尾，取转换体
            seg = src[m.start():]
            nxt = seg.find('\nimpl ', 1)
            seg = seg[:nxt] if nxt > 0 else seg
            checked += 1
            if 'AppError::' in seg and 'AppError::Infra' not in seg:
                line = src[:m.start()].count('\n') + 1
                bad.append(f'{f.relative_to(ROOT)}:{line}  {m.group(0)}')
    if not checked:
        print('✗ 一处外部错误的 From 转换都没找到 —— 判据的形状变了？这一步没法判。',
              file=sys.stderr)
        return 2
    if bad:
        print('✗ 这几处把外部库的报错原文放进了会发给客户端的消息里：', file=sys.stderr)
        for b in bad:
            print('    ' + b, file=sys.stderr)
        print('  改成 AppError::Infra(...)：Display 是固定的 internal error，', file=sys.stderr)
        print('  原文走 AppError::detail() 进日志。', file=sys.stderr)
        return 1
    print(f'✓ {checked} 处外部报错转换都走 Infra，原文不进响应体')
    return 0


sys.exit(main())
