#!/usr/bin/env python3
"""区的名字只有一处说了算。

【为什么要有这一支】——2026-09-05 查到：这个产品里【三套区名同时活着】。

  名册 `region_registry`（`GET /admin/regions` 发的那张表，顶栏那个
  「看的是」按它列）      cn / jp / kr / sea / na / zh_hant
  领域枚举 `Region`        同上六格（`commerce/region.rs`）
  后台三个页面各写死一份   cn / hk / tw / jp / us / eu

**两边只有 cn 与 jp 对得上。** 后果一条条都是真的：

  · 定价页那个下拉框挑 `tw` 发出去的价，落进一个谁也查不到的 region
  · 灰度页按 `tw` 关掉一个功能，永远关不到人
  · 用户页按 `us` 筛，恒定 0 条 —— 跟「这个区真没人」长得一模一样
  · 验收夹具把第二个管理员的 scope 写成 `{hk}`，而按名册过滤之后
    他的顶栏下拉框【一条都不剩】

这一支管两件事：

  一、名册与枚举对得上（要库；连不上就说跳过，不报绿）
  二、后台页面里不许再写死一份区名单 —— 名单从 `lib/regions.ts` 来

不管【库里已经躺着的那些值】（`hk` / `p25` / `verify` / `zz` 都有真行）。
那是历史与夹具，改它要动数据，不是改一行代码的事；记在
docs/ACCEPTANCE-25.md 里，别在这儿假装它不存在。
"""
import os
import pathlib
import re
import subprocess
import sys

根 = pathlib.Path(__file__).resolve().parent.parent
URL = os.environ.get('DATABASE_URL',
                     'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')

坏 = []
说 = []


# ── 一 · 名册与枚举 ────────────────────────────────────────
def 库里的区():
    try:
        out = subprocess.run(
            ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei', '-d', 'unmei',
             '-tAc', 'SELECT code FROM region_registry ORDER BY 1'],
            capture_output=True, text=True, timeout=20)
        if out.returncode != 0:
            return None
        return sorted(x for x in out.stdout.split() if x)
    except Exception:
        return None


枚举源 = (根 / 'backend/unmei-domain/src/commerce/region.rs').read_text(encoding='utf-8')
# `"cn"      => Ok(Self::Cn),` 这一串就是这个枚举认得的全部写法
枚举 = sorted(set(re.findall(r'"([a-z_]+)"\s*=>\s*Ok\(Self::', 枚举源)) - {'global'})
if len(枚举) < 3:
    print(f'✗ 从 region.rs 只解出 {len(枚举)} 个区名 —— 正则多半没匹配上，这一支在空转')
    sys.exit(1)

名册 = 库里的区()
if 名册 is None:
    说.append('— 连不上库，「名册与枚举对得上」这一条【没验】，不是通过')
elif 名册 != 枚举:
    坏.append(f'✗ 名册与枚举对不上：\n     名册 {名册}\n     枚举 {枚举}\n'
              '     两边都在被读:顶栏那个下拉框按名册列，而 `Region::from_str` 按枚举收')
else:
    说.append(f'✓ 名册与枚举对得上 · {len(名册)} 格（{"、".join(名册)}）')

# ── 二 · 后台页面里不许写死区名 ─────────────────────────────
# 退了役的那几个也算数 —— 它们正是这一支要抓的东西
词表 = set(枚举) | {'hk', 'tw', 'us', 'eu'}
页 = sorted((根 / 'webadmin/src/pages').glob('*.tsx'))
if len(页) < 10:
    print(f'✗ 只找到 {len(页)} 个后台页面 —— 路径多半不对，这一支在空转')
    sys.exit(1)

for f in 页:
    src = f.read_text(encoding='utf-8')
    # 去掉注释:注释里【说】哪些区名是错的，正是这一支希望留下的话
    干净 = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    干净 = re.sub(r'^\s*//.*$', '', 干净, flags=re.M)

    for 组 in re.findall(r'\[([^\[\]\n]{4,200})\]', 干净):
        串 = re.findall(r"'([a-z_]{2,8})'", 组)
        命中 = [x for x in 串 if x in 词表]
        if len(命中) >= 2:
            坏.append(f'  ✗ {f.relative_to(根)} 里写死了一串区名：{命中}\n'
                      '     区名只有名册说了算 —— 用 `lib/regions.ts` 的 useRegions() / useMyRegions()')

    for 值 in re.findall(r'<option\s+value="([a-z_]{2,8})"', 干净):
        if 值 in 词表:
            坏.append(f'  ✗ {f.relative_to(根)} 里写死了一个区的 <option>：{值}\n'
                      '     区名只有名册说了算 —— 用 `lib/regions.ts` 的 useRegions() / useMyRegions()')

for l in 说:
    print('  ' + l)
for l in 坏:
    print(l)

if 坏:
    print(f'✗ 区名有 {len(坏)} 处不出自名册')
    sys.exit(1)
print(f'✓ 区名只有名册说了算 · 扫了 {len(页)} 个后台页面')
