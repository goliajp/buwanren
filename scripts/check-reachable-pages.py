#!/usr/bin/env python3
"""每一页都得有办法走到 —— 小程序与后台控制台各一套。

2026-08-19 抓到的：`pages/village` 谁也不指向它，也不在 tabBar 上——
装出来的包里根本进不去。而**全应用唯一的扫码入口**就在那一页上，
于是御守→村民→屋子这条主线在真机上是死的，
`pages/room` 跟着一起死（它只从村里进）。

单测、门禁、镜像验证全绿，因为它们都是**照着页面名去开页面**的：
`wx.navigateTo('/pages/village/index')` 当然开得起来。没有人问过
「用户从哪儿点得到它」。

判据只看两样：在 tabBar 上，或者被别处的 navigateTo / redirectTo /
switchTab / reLaunch / navigator 指着。传递可达——被可达的页指着也算。
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MINI = ROOT / 'mini' / 'miniprogram'


def strip_comments(s: str) -> str:
    return re.sub(r'^\s*//.*$', '', s, flags=re.M)


def main() -> int:
    app = json.loads(strip_comments((MINI / 'app.json').read_text(encoding='utf-8')))
    pages = app['pages']
    if not pages:
        print('✗ app.json 里一页都没读出来 —— 它的格式变了？这一步没法判。', file=sys.stderr)
        return 2

    tabs = {t['pagePath'] for t in app.get('tabBar', {}).get('list', [])}

    # 谁指向谁。只扫页面自己的源码，services/ 之类不开页面。
    #
    # 要分导航方式：`wx.switchTab` 只对 tabBar 上的页有效，
    # 指向非 tab 页时运行时直接失败 —— 那不是一条可达边，是一个 bug。
    # 早先这里只按路径正则匹配、不看方式，于是 2026-08-22 把「村」从 tab 上
    # 摘掉的那个变异没被抓到：另一页里一句 switchTab 指着它，就被当成还走得到。
    # 在一次 wx.xxx({...}) 调用里找【所有】提到的页面路径，而不是只认
    # `url: '...'` 这一种写法。第一版只认字面量，于是村主屏里
    #     url: this.atHome[id] ? '/pages/villager/index?id=' + id : '/pages/plot/index'
    # 这个三元里的第二支看不见，`plot` 被判成走不到 —— 而它明明点得到。
    # 太松（早先按路径全文匹配）与太严（只认字面量）都会说谎，取中间：
    # 认调用的边界，边界内的路径都算。
    NAV = re.compile(
        r'wx\.(switchTab|navigateTo|redirectTo|reLaunch)\s*\(\s*\{(.*?)\}\s*\)',
        re.S)
    # 反引号也要认:`/pages/report/index?id=${id}` 是最常见的带参跳法。
    # 不认的话它长得跟「谁也不指向这一页」一模一样 —— 2026-08-28 报过一次,
    # 而那一页明明是从单子上点进去的。
    PAGEPATH = re.compile(r'[\'"`]/?((?:pages|packages)/[\w./-]+?)(?:[?\'"`])')
    links: dict[str, set[str]] = {p: set() for p in pages}
    bad_switch: list[str] = []
    for p in pages:
        text = ''
        for suffix in ('index.ts', 'index.wxml'):
            f = MINI / p.replace('/index', '') / suffix
            if f.exists():
                text += f.read_text(encoding='utf-8')

        # 这一页 import 的 utils 也要算进来。两页共用的那一下只能住在
        # utils（页面之间不许互相 import），而跳哪一页往往就写在里面 ——
        # `utils/omamori.ts` 里那句 navigateTo('/pages/moved/index') 就是。
        # 只读页面文件的话，`moved` 会被判成「谁也不指向它」。
        #
        # 只并【这一页真的 import 了的】那几支，不是把 utils 全并进来：
        # 全并等于让每一页都指向所有 utils 提到的页，那样 `moved` 从任何
        # 一页都「到得了」—— 判据一放宽，这支门禁就再也认不出真的死页。
        for m in re.finditer(r"from ['\"][^'\"]*utils/([\w-]+)['\"]", text):
            u = MINI / 'utils' / (m.group(1) + '.ts')
            if u.exists():
                text += u.read_text(encoding='utf-8')

        for kind, body in NAV.findall(text):
            for url in PAGEPATH.findall(body):
                target = url.lstrip('/')
                if target not in pages:
                    continue
                if kind == 'switchTab' and target not in tabs:
                    bad_switch.append(f'{p} → switchTab("{url}")')
                    continue      # 运行时会失败，不算走得到
                links[p].add(target)

        # wxml 里的 <navigator> 与其余写法：按路径匹配就够，它们不挑 tab
        for target in pages:
            if re.search(r'<navigator[^>]*/?' + re.escape(target), text):
                links[p].add(target)

    if bad_switch:
        print('✗ 有 switchTab 指向不在 tabBar 上的页 —— 这在真机上会失败：', file=sys.stderr)
        for b in bad_switch:
            print('   ' + b, file=sys.stderr)
        print('  要么把它改成 navigateTo，要么把那一页放上 tabBar。', file=sys.stderr)
        return 1

    # 从入口传递地走一遍。入口 = tabBar 上的那几页 + 第一页（没有 tabBar 时）
    entry = tabs or {pages[0]}
    seen, queue = set(entry), list(entry)
    while queue:
        cur = queue.pop()
        for nxt in links.get(cur, ()):
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)

    orphans = [p for p in pages if p not in seen]
    if orphans:
        print('✗ 这些页从入口走不到 —— 装出来的包里用户点不进去：', file=sys.stderr)
        for p in orphans:
            print(f'    {p}', file=sys.stderr)
        print('  要么给它一个 tabBar 位置，要么让某一页指向它。', file=sys.stderr)
        return 1
    print(f'✓ 小程序 {len(pages)} 页都走得到（tabBar {len(tabs)} 个入口）')
    return admin()


def admin() -> int:
    """后台控制台：每条路由都得在侧边栏上，侧边栏上的每一项也都得有路由。

    这一支是照着**真事**写的：Users 那一页从初始提交起就挂在侧边栏上，
    而它请求的 `/admin/users` 后端根本没有 —— 前端拿到 404 当成「没数据」，
    页面就那么空着，两边的门禁都不会红。那件事的另一半（接口对不对得上）
    由 `check-routes.py` 守着；这里守的是「页面与入口对不对得上」。
    """
    app = (ROOT / 'webadmin/src/App.tsx')
    layout = (ROOT / 'webadmin/src/components/Layout.tsx')
    if not app.exists() or not layout.exists():
        print(f'✗ 找不到后台控制台的源码（{app.name} / {layout.name}）—— 这一步没法判。',
              file=sys.stderr)
        return 2

    routes = set(re.findall(r'<Route\s+path="([^"*]+)"', app.read_text(encoding='utf-8')))
    routes.discard('/login')  # 登录页不该在侧边栏上
    navs = set(re.findall(r"\{\s*to:\s*'([^']+)'", layout.read_text(encoding='utf-8')))
    if not routes or not navs:
        print(f'✗ 路由 {len(routes)} 条 / 侧边栏 {len(navs)} 项 —— 有一边没解析出来，'
              '这一步没法判，不去指控产品。', file=sys.stderr)
        return 2

    没入口 = sorted(routes - navs)
    没页面 = sorted(navs - routes)
    if 没入口 or 没页面:
        if 没入口:
            print('✗ 后台这几页在路由里，却不在侧边栏上 —— 打得开但没人点得到：',
                  file=sys.stderr)
            for r in 没入口:
                print(f'    {r}', file=sys.stderr)
        if 没页面:
            print('✗ 侧边栏上这几项没有对应的路由 —— 点了会被打回总览：', file=sys.stderr)
            for r in 没页面:
                print(f'    {r}', file=sys.stderr)
        return 1
    print(f'✓ 后台 {len(routes)} 页与侧边栏一一对上')
    return 0


sys.exit(main())
