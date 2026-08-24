#!/usr/bin/env bash
# 仓库里**每一条** workflow 在当前 HEAD 上是什么状态。
#
# 起因:2026-08-17,我给村线写了 CI 之后就一直只盯着 `rooms`,
# 而仓库里还有一条更早的 `backend` —— 它连红四次没人看见,红的还是我自己
# 引入的测试。「我关心的那条绿了」不等于「CI 绿了」。
#
# 带 paths 过滤的 workflow 不会在每个 commit 上都跑,所以「最后一次绿」
# 未必对当前 HEAD 成立。这里会顺带检查:那次绿之后,它关心的路径动过没有。
#
# 用法:bash scripts/ci-status.sh [git-ref]     默认 HEAD
set -u
REF="${1:-HEAD}"
SHA=$(git rev-parse "$REF")
command -v gh >/dev/null || { echo "需要 gh"; exit 2; }

echo "══ CI 状态 · $(git rev-parse --short "$SHA") ══"
bad=0
for wf in $(ls .github/workflows/*.yml 2>/dev/null); do
  name=$(basename "$wf" .yml)
  # 这条 workflow 关心哪些路径(paths 段;没有就是全仓)
  paths=$(python3 - "$wf" <<'PY'
import re, sys
s = open(sys.argv[1], encoding='utf-8').read()
# 两种写法都要认:
#   paths: ['a/**', 'b']        单行数组
#   paths:                      多行列表
#     - 'a/**'
# 只认单行的话,多行那种会被当成「没有过滤」,于是任何一次改动都报
# 「它关心的路径动过了」——工具喊狼来了,人就开始无视它。
# mini.yml 用的正是多行写法,改一个 docs/ 里的字它就报红。
out = []
for m in re.finditer(r'^([ ]*)paths:[ ]*(\[(.*?)\])?[ ]*$', s, re.M):
    if m.group(3) is not None:
        out += [p.strip().strip("'\"") for p in m.group(3).split(',')]
        continue
    indent = len(m.group(1))
    for line in s[m.end():].split('\n'):
        if not line.strip():
            continue
        cur = len(line) - len(line.lstrip())
        # 注释行要【跳过】,不能当成列表结束 —— slice.yml 的两条
        # `!**/*.md` 前面各有一行注释,一 break 就把排除整个丢了,
        # 于是改一份 README 它照样报「那条重的 workflow 该重跑」。
        # 这正是本文件上面那句「工具喊狼来了,人就开始无视它」。
        if line.strip().startswith('#'):
            continue
        item = re.match(r'-[ ]*(.+)$', line.strip())
        if cur <= indent or not item:
            break
        out.append(item.group(1).strip().strip("'\""))
# workflow 里的 `!x` 是【排除】,而 git 的排除写法是 `:(exclude)x` ——
# 原样传给 git 的话它当成一个匹配不到任何东西的普通路径,
# 于是排除不生效,工具照旧为一份 README 报「那条重的 workflow 该重跑」。
out = [(':(exclude)' + x[1:] if x.startswith('!') else x) for x in out]
print(' '.join(x for x in out if x))
PY
)
  row=$(gh run list --workflow="$name.yml" --limit 20 \
        --json headSha,conclusion,status,databaseId \
        --jq "[.[] | select(.status==\"completed\")] | .[0] // empty" 2>/dev/null)
  [ -z "$row" ] && { printf '  %-10s 从没跑过\n' "$name"; bad=1; continue; }

  concl=$(echo "$row" | python3 -c 'import json,sys; print(json.load(sys.stdin)["conclusion"])')
  rsha=$(echo "$row" | python3 -c 'import json,sys; print(json.load(sys.stdin)["headSha"])')
  rid=$(echo "$row" | python3 -c 'import json,sys; print(json.load(sys.stdin)["databaseId"])')

  mark=$([ "$concl" = success ] && echo ✓ || echo ✗)
  [ "$concl" = success ] || bad=1

  if [ "$rsha" = "$SHA" ]; then
    printf '  %s %-10s %s  就在这个 commit 上\n' "$mark" "$name" "$concl"
  else
    # 不在当前 commit:看它关心的路径这段时间动过没有
    changed=""
    if [ -n "$paths" ]; then
      # shellcheck disable=SC2086
      changed=$(git diff --name-only "$rsha".."$SHA" -- $paths 2>/dev/null | head -3)
    else
      changed=$(git diff --name-only "$rsha".."$SHA" 2>/dev/null | head -3)
    fi
    if [ -z "$changed" ]; then
      printf '  %s %-10s %s @ %s（此后它关心的路径没动过，结论仍成立）\n' \
        "$mark" "$name" "$concl" "$(git rev-parse --short "$rsha")"
    else
      printf '  ! %-10s 最后一次是 %s @ %s，但之后这些动过：%s\n' \
        "$name" "$concl" "$(git rev-parse --short "$rsha")" "$(echo "$changed" | tr '\n' ' ')"
      printf '    → 它在当前 HEAD 上还没跑过，别把上一次的绿当成这一次的\n'
      bad=1
    fi
  fi
  # `gh run view --log-failed` 走的是 jobs 接口,而那个接口在这个仓库上
  # 经常 404(2026-08-17/18 整整两天都是),于是失败原因根本读不到,
  # ——只解 `0_*.txt`:那是整份运行日志,而按步骤拆出来的那些文件名是中文,
  #   macOS 的 unzip 解它们会报错中断(踩过)。
  # 只能靠猜 —— 我就照着猜错过一次。归档那条路不经过 jobs,是通的。
  [ "$concl" = success ] || printf '    详情：gh run view %s --log-failed\n           读不到就换这条（不经过 jobs 接口，404 时照样能拿）:\n           gh api repos/goliajp/buwanren/actions/runs/%s/logs > /tmp/l.zip && unzip -o /tmp/l.zip 0_*.txt -d /tmp/l\n' "$rid" "$rid"
done

echo
[ $bad -eq 0 ] && echo "全部 workflow 绿，且对当前 commit 成立" || echo "有 workflow 未过或结论不适用于当前 commit"
exit $bad
