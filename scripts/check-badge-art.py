#!/usr/bin/env python3
"""每一枚在发的徽章都得有像素图。

屏上原先是印刷体汉字（香 / 月 / 七 / 百 / 头）摆在一圈虚线里 —— 系统字。
而这个产品全身是像素画:四十位村民、六间屋、一整幅村子、底栏三对图标、
四张空态道具。混一套系统字进来，那一屏立刻读成「还没做完」
（2026-09-01 第二轮评审 · 视觉）。

判据三条，都机械:
  · 库里每一枚 `status='active'` 的徽章，`code` 都要在页面的图名表里
  · 表里每一个名字，两张 PNG（得到 / 没得到）都要真在磁盘上
  · 表里不许有【库里没有的】名字 —— 那是删了徽章却留着图，
    下一个人会以为那枚还在发

新加一枚徽章的顺序是【先画图、再上架】，跟 `report::出得了的册子` 一样。
"""
import os
import re
import subprocess
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parent.parent
页 = 根 / 'mini/miniprogram/pages/badges/index.ts'
图库 = 根 / 'mini/miniprogram/images'


def 问库(q):
    url = os.environ.get('PSQL_URL') or os.environ.get('DATABASE_URL')
    cmd = (['psql', url, '-tAc', q] if url
           else ['docker', 'exec', 'unmei-postgres', 'psql', '-U', 'unmei',
                 '-d', 'unmei', '-tAc', q])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'✗ 库问不到，徽章那一屏没验成：{r.stderr.strip()[:160]}')
        sys.exit(2)
    return [l for l in r.stdout.strip().split('\n') if l]


if not 页.exists():
    print('✗ 找不到 badges/index.ts —— 这一支够不着要验的东西')
    sys.exit(1)

源 = 页.read_text(encoding='utf-8')
m = re.search(r'const 图名\s*:\s*Record<string, string>\s*=\s*\{([^}]*)\}', 源, re.S)
if not m:
    print('✗ badges/index.ts 里找不到 `图名` 那张表 —— 页面改过而这一支没跟上')
    sys.exit(1)
表 = dict(re.findall(r"'?([\w]+)'?\s*:\s*'([\w-]+)'", m.group(1)))

在发的 = [l for l in 问库("SELECT code FROM badge WHERE status='active' ORDER BY code")]
if not 在发的:
    print('✗ 库里一枚在发的徽章都没有 —— 这一支够不着要验的东西')
    sys.exit(1)

错 = []
for code in 在发的:
    if code not in 表:
        错.append(f'徽章 {code} 在发，而图名表里没有它 —— 屏上会退回印刷体汉字')
for code, 图 in 表.items():
    if code not in 在发的:
        错.append(f'图名表里有 {code}，而库里没有这一枚在发 —— 删徽章时忘了删图名')
    for 后缀 in ('', '-off'):
        f = 图库 / f'badge-{图}{后缀}.png'
        if not f.exists():
            错.append(f'{code} 指着 {f.name}，而这张图不在 {图库.relative_to(根)} 里')

for e in 错:
    print('  ✗ ' + e)
print(('✗ ' if 错 else '✓ ') + f'徽章都有像素图 · 在发 {len(在发的)} 枚 · 图 {len(表) * 2} 张')
sys.exit(1 if 错 else 0)
