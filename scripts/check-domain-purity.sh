#!/usr/bin/env bash
# unmei-domain 是最内层:不许依赖任何数据库 / HTTP / Web 框架。
# 依赖方向是 api → app → domain ← 持久化实现。
#
# 判据用【依赖树】而不是 grep 源码 —— 注释里提到 sqlx 不算违规,
# 而通过某个中间 crate 间接引入却是真违规,只有依赖树看得见。
# P0 时 domain/src 里有 215 处基础设施引用,P1 后 24,P2 归零。
#
# 2026-08-25:这一支原先只在 CI 的 backend.yml 里跑。CI 删掉时差点跟着丢 ——
# 「只在 CI 里跑过」的东西，删 CI 那天没人会想起它们。
set -u
cd "$(dirname "$0")/../backend"
if tree=$(cargo tree -p unmei-domain 2>/dev/null); then
  if echo "$tree" | grep -qE '(sqlx|axum|reqwest|hyper|tower)'; then
    echo "✗ unmei-domain 依赖了基础设施库。domain 是最内层，依赖方向反了。"
    echo "  把持久化 / 传输相关的东西放到 unmei-app 或适配器 crate 里。"
    echo "$tree" | grep -E '(sqlx|axum|reqwest|hyper|tower)' | head -5
    exit 1
  fi
  echo "✓ domain 纯净（依赖树里没有 sqlx / axum / reqwest / hyper / tower）"
  exit 0
fi
echo "✗ cargo tree 跑不起来 —— 这一项【没验】，不是通过"
exit 1
