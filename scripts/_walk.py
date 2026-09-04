"""走源码树的时候，不要走进构建产物。

【为什么单独一个文件】（2026-09-05 · 门禁里连着卡了两次）。
`ROOT.glob('backend/**/*.md')` 与 `根.rglob('*.rs')` 都会把整棵
`backend/target` 走一遍 —— 那天它是 23 GB、4674 个目录
（`cargo check --workspace --all-targets` 跑过之后涨起来的）。

三支门禁各自写了过滤，而过滤都写在【结果】上：

    if 'target' in rel: continue          # check-punct
    if rel.startswith('target'): continue # check-silent-zero —— 而且没匹配上，
                                          #   真路径是 `backend/target/…`
    （check-webadmin-cn 一个都没有）

写在结果上挡得住误报，挡不住走路那一步。于是这几支从一秒变成好几分钟,
而慢到一定程度跟卡死分不出来 —— 那天我两次去查「是不是死锁」,
第二次才想起来看栈:它停在 `glob.py` 的 `scandir` 上。

这里把「不进去」做在走路那一步。
"""
import fnmatch
import os
from pathlib import Path

# 不走进去的目录名。判据是「这里面的东西不是人写的源码」——
# 构建产物、装回来的依赖、版本库自己的东西。
不进 = {
    'node_modules', 'target', 'dist', 'build', '.git',
    '.venv', 'venv', '__pycache__', '.next', '.turbo', 'coverage',
}


def 走(根, 模式):
    """按 glob 模式找文件，但不走进 `不进` 里那几种目录。

    只认两种形状，够这个仓用:
      · 带 `**/` 的（`backend/**/*.md`）—— 自己走，边走边剪
      · 不带的（`*.md`、`.claude/design/*.html`）—— 就那一层，
        pathlib 直接来，本来也不会走远
    """
    根 = Path(根)
    前, 有星, 尾 = 模式.partition('**/')
    if not 有星:
        yield from sorted(根.glob(模式))
        return
    起 = 根 / 前 if 前 else 根
    if not 起.is_dir():
        return
    出 = []
    for 目录, 子目录, 文件 in os.walk(起):
        子目录[:] = sorted(d for d in 子目录 if d not in 不进)
        for 名 in 文件:
            if fnmatch.fnmatch(名, 尾):
                出.append(Path(目录) / 名)
    yield from sorted(出)


def 全找(根, 尾):
    """整棵树里找某一类文件（`*.rs` / `*.tsx`），同样不走进构建产物。"""
    yield from 走(根, '**/' + 尾)
