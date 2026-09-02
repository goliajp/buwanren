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
    # 【真正在走的那条路，不是那三个 impl】（2026-09-02 第四轮评审 · 工程审计）。
    # 上面只查 `impl From<sqlx::Error> for …`，而全后端走的是
    # `DbResultExt::db()` → `DomainError::Repository(e.to_string())` →
    # `AppError::Domain`（`#[error(transparent)]`）→ 响应体。
    # 审计对 `/v1/orders` 的 note 塞一个 NUL 字节，拿到了
    # `{"error":"repository: error returned from database: invalid byte
    #  sequence for encoding \"UTF8\": 0x00"}` —— 而这一支同时报着
    # 「✓ 6 处外部报错转换都走 Infra」。
    #
    # 修法是让 `Repository` 跟 `Infra` 走同一条路:原文进日志、屏上说人话。
    # 这里守住那条路还在:
    #   · `AppError::出面()` 要存在，且把 Repository 换成不含库原文的话
    #   · 响应体要用 `出面()`，不是 `to_string()`
    err_rs = (ROOT / 'backend/unmei-domain/src/error.rs').read_text(encoding='utf-8')
    auth_rs = (ROOT / 'backend/unmei-api/src/auth.rs').read_text(encoding='utf-8')
    if 'fn 出面' not in err_rs:
        bad.append('unmei-domain/src/error.rs  没有 `AppError::出面()` —— '
                   '库的原文会顺着 Domain(Repository(..)) 原样出现在响应体里')
    elif not re.search(r'Domain\(DomainError::Repository\(_\)\)\s*=>\s*"internal error"', err_rs):
        bad.append('unmei-domain/src/error.rs  `出面()` 不再把 Repository 挡下来 —— '
                   '库的原文会上屏')
    if 'self.0.出面()' not in auth_rs:
        bad.append('unmei-api/src/auth.rs  响应体没用 `出面()` —— '
                   '换回 to_string() 等于把库原文放出去')
    checked += 2

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
