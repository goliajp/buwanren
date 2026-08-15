#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""婆婆房 S2 平面图 —— 纯坐标 + 校验（planlint 等价物）
校验：P1 家具不重叠 · P2 门口禁区 · P3 越界 · P4 从门口 BFS 全部空闲格可达
"""
from collections import deque

W, H, WALLH, EXT = 1440, 2560, 440, 2160

# id, x, y, w, h, foot(ox,oy,fw,fh) or None(挂件/地毯不占地), 说明
# ── 墙面带 y 0..440（wall:true，不占地）──
WALL = [
    ("popo_cobweb",          0,    0,  200, 190, None, "蜘蛛网 · 左上角"),
    ("popo_fireplace",      40,  190,  300, 250, None, "壁炉 · 一直烧着（给别人暖）"),
    ("popo_photo_wall",    366,   60,  270, 104, None, "动物照片墙 ×3"),
    ("popo_window_night",  372,  186,  244, 244, None, "圆窗 · 夜空月牙"),
    ("popo_birthday_board",660,   80,  186, 206, None, "★生日日历 · 记全村每个人的生日"),
    ("popo_herb_hang",     880,   40,  120, 130, None, "草药束倒挂"),
    ("popo_window_small",  860,  196,  190, 190, None, "小圆窗"),
    ("popo_knit_pattern", 1060,   60,  200, 230, None, "★给孩子织的图样（她照着给动物织）"),
    ("popo_shelf_potions",1090,  300,  300, 138, None, "药瓶架 · 给别人配的"),
    ("popo_hat_stand",    1290,   60,  130, 200, None, "帽架 + 备用尖帽"),
]

# ── 地面 y 440..2160 ──
FLOOR = [
    # 左列
    ("cloak_hook",           40,  452, 100, 180, None,               "斗篷挂钩（generic）"),
    ("popo_mirror_veiled",   56,  690, 132, 330, (0,286,132,44),     "蒙布镜"),
    ("popo_book_tower",      56, 1108, 140, 230, (0,186,140,44),     "魔法书塔 ×5"),
    ("popo_pumpkins",       216, 1216, 130,  92, (0,40,130,52),      "南瓜 ×2"),
    ("popo_owl_perch",      112, 1592, 176, 320, (44,268,88,52),     "猫头鹰栖架"),
    ("crates_stack",         44, 1936, 160, 190, (10,130,140,60),    "快递箱堆（网购 · generic）"),
    # 灶 —— 「每天煮的饭都比一个人多」
    ("popo_stove",          212,  700, 300, 300, (16,196,268,104),   "★灶台 + 大锅（煮的饭比一个人多）"),
    ("popo_bowl_shelf",     212, 1010, 210, 130, (0,74,210,56),      "★碗架：给别人的一摞 ↔ 她那只豁口碗"),
    # 中央 · 读牌区（核心）
    ("popo_rug_star",       430,  880, 580, 560, None,               "星纹圆毯（地毯不占地）"),
    ("popo_table_read",     556, 1024, 340, 250, (0,112,340,138),    "★读牌桌"),
    ("popo_crystal_ball",   666,  936, 116, 116, None,               "水晶球（attach 桌）"),
    ("popo_cards_new",      588, 1146, 150,  76, None,               "★新的那副牌（天天在用，attach 桌）"),
    ("popo_drawer",         586, 1238, 280,  96, None,               "★★抽屉 · 里面是旧牌（有状态，attach 桌）"),
    ("tao_stool_embroidered",452,1150, 120, 190, (8,110,104,74),     "读牌的凳（generic）"),
    ("popo_qr_stand",       930, 1160, 100, 130, (14,96,72,34),      "扫码问事立牌"),
    # 待客区（右中）—— 糖罐 / 碗 / 茶具 / 缺口杯 四件同框
    ("tao_rug_tea",        1020, 1150, 300, 200, None,               "茶点方毯（generic）"),
    ("popo_table_guest",   1060, 1180, 340, 230, (0,104,340,126),    "★待客桌"),
    ("popo_tea_set",       1080, 1112, 150,  86, None,               "★成套茶具（给客人的，attach）"),
    ("popo_own_cup",       1244, 1136,  62,  62, None,               "★她的杯子 · 缺口（attach）"),
    ("popo_candy_jar",     1316, 1104,  76,  96, None,               "★糖罐 · 满出来（attach）"),
    ("popo_own_bowl",      1172, 1150,  68,  50, None,               "★她的碗 · 只有一只（attach）"),
    ("cushion_round",      1060, 1428, 140, 100, None,               "蒲团（generic · 可踩）"),
    # 床（右上）
    ("popo_bed",           1080,  480, 340, 430, (8,296,324,134),    "床 · 铁架星纹被"),
    ("popo_laptop",        1148,  686, 132, 112, None,               "笔记本 · 在线接单（attach 床）"),
    ("popo_coffee_cup",    1036,  846,  48,  58, (0,44,48,14),       "外卖咖啡杯"),
    # 摇椅区（右下）—— 毛衣堆 ↔ 她的披肩
    ("popo_rocking_chair", 1146, 1508, 220, 220, (6,140,208,74),     "★摇椅"),
    ("popo_own_shawl",     1152, 1512, 180, 128, None,               "★她的披肩 · 磨破了没换（attach 摇椅）"),
    ("popo_sweater_pile",  1080, 1830, 132, 126, (0,62,132,60),      "★给动物织的毛衣 · 堆成山"),
    ("popo_yarn_basket",   1068, 1676, 148, 116, (0,50,148,62),      "★毛线筐 + 织了一半的活计"),
    # 动物角（中下）
    ("popo_nest_wicker",    272, 1704, 104,  82, (0,26,104,52),      "藤编窝 A"),
    ("popo_nest_wicker",    392, 1780, 104,  82, (0,26,104,52),      "藤编窝 B"),
    ("popo_nest_wicker",    556, 1712, 104,  82, (0,26,104,52),      "藤编窝 C"),
    ("popo_food_bowls",     676, 1700, 250,  70, (0,26,250,40),      "食盆排 ×3 + 撒粮"),
    ("popo_snack_jar",      600, 1636,  56,  70, (0,44,56,26),       "零食罐 · 鱼干"),
    ("popo_cat_toy",        488, 1560,  90,  70, None,               "逗猫棒（地面小件）"),
    ("popo_yarn_ball",      930, 1560,  90,  70, None,               "毛线球 + 散线"),
    # 门与前景
    ("popo_door_mat",       616, 1972, 230,  76, None,               "门垫 · 星纹"),
    ("popo_omamori_door",   860, 1856, 176, 210, (34,178,96,28),     "★★门边御守架：挂满 ↔ 一枚空钩"),
    ("popo_bell_pole",      556, 1820,  50, 180, (14,158,26,26),     "铃铛串立杆"),
    ("popo_shoes",          876, 1996,  70,  52, None,               "尖头鞋一双"),
    ("broom",               400, 1900, 100, 240, (34,196,40,36),     "扫帚（generic）"),
    ("popo_scroll_pile",    700, 1520,  70,  46, (0,20,70,24),       "卷轴堆"),
    # 蜡烛（整屋一种光）
    ("popo_candles",        552, 1500,  92,  70, (0,44,92,24),       "烛台组 A"),
    ("popo_candles",        916,  820,  92,  70, (0,44,92,24),       "烛台组 B"),
    ("popo_candles",        118, 1420,  92,  70, (0,44,92,24),       "烛台组 C"),
    ("popo_amethyst",       430,  930,  62,  46, None,               "紫水晶簇 A"),
    ("popo_amethyst",       952, 1500,  62,  46, None,               "紫水晶簇 B"),
    ("popo_rune_stones",    500,  756, 140,  56, None,               "符文石 ×5（地面）"),
    ("popo_wand",           852,  776,  84,  30, None,               "魔杖 · 星尖"),
    ("popo_phone",          788, 1144,  36,  62, None,               "★智能机 · 发六十秒语音条（attach 桌）"),
    # 延伸带 y>2160
    ("popo_ext_rug",        596, 2264, 250, 120, None,               "前景毯"),
    ("tao_ext_crate",      1020, 2210, 160, 150, None,               "前景木箱（generic）"),
    # ── 第二批：把「满」做够 —— 每一件都指向「她给出去的东西」──
    ("popo_cauldron",       236, 1300, 260, 300, (16,196,228,104),   "药锅 · 三足（给别人熬的）"),
    ("popo_distiller",      470, 1330, 160, 120, (0,60,160,60),      "蒸馏器"),
    ("popo_book_stand",    1096,  940, 216, 148, (0,64,216,84),      "魔法书台 · 摊开的大部头"),
    ("popo_astrolabe",     1250,  900,  70,  76, None,               "星盘仪（attach 书台）"),
    ("popo_balance",       1330, 1000, 100, 100, (0,80,100,20),      "黄铜天平"),
    ("popo_mandrake",      1000,  960,  90,  60, (0,26,90,34),       "曼德拉草盆栽"),
    ("popo_specimen_jars",  204,  452, 250, 100, None,               "标本瓶排"),
    ("popo_dream_catcher",  470,  452, 100, 150, None,               "捕梦网"),
    ("popo_palm_chart",     620,  452,  96, 122, None,               "掌纹图挂画"),
    ("popo_sweater_hang",   760,  452, 240, 110, None,               "★晾着的小毛衣一串（都是给动物的）"),
    ("popo_floating_candles",600, 620, 300, 130, None,               "浮空蜡烛 ×3"),
    ("popo_mouse_hole",    1380,  396,  60,  44, None,               "老鼠洞 · 两只眼睛（她也留了它）"),
    ("popo_rune_floor",     690, 1400, 160,  60, None,               "地板符文刻痕"),
    ("popo_crystal_grid",   952, 1596, 150, 110, None,               "水晶阵 ×7"),
    ("popo_gift_stack",     960, 1400, 130, 130, (0,70,130,60),      "★包好的生日礼物一摞 · 提前一天准备"),
    ("popo_tarot_spread",   400, 1880, 250, 190, None,               "地上摊开的凯尔特十字牌阵"),
    ("popo_slippers_guest", 330, 1996, 180,  60, None,               "★给客人的拖鞋一排"),
    ("popo_slippers_own",   250, 2032,  76,  52, None,               "★她自己那双 · 磨平了"),
    ("popo_nest_wicker",    836, 1620, 104,  82, (0,26,104,52),      "藤编窝 D"),
    ("popo_nest_wicker",    444, 1652, 104,  82, (0,26,104,52),      "藤编窝 E"),
    ("popo_nest_bird",      296, 1500, 120, 150, (10,120,100,30),    "鸟架窝"),
    ("popo_food_bowls",     260, 1856, 250,  70, (0,26,250,40),      "食盆排 B"),
    ("popo_biscuit_tin",    856, 1780,  80,  80, (0,56,80,24),       "饼干罐"),
    ("popo_portal",        1180, 1660, 200, 400, (0,300,200,74),     "动物传送门（它们自己会来）"),
    ("popo_cat_bowl",      1360, 1600,  80, 100, (0,66,80,34),       "猫粮碗 + 鱼骨"),
]

DOOR = (720, 1990)          # 门口进入点

def rects(items):
    out = []
    for it in items:
        n, x, y, w, h, f, _ = it
        if not f: continue
        out.append((n, x + f[0], y + f[1], f[2], f[3]))
    return out

def main():
    errs = []
    all_items = WALL + FLOOR
    # P3 越界
    for n, x, y, w, h, f, d in all_items:
        if x < 0 or y < 0 or x + w > W or y + h > H:
            errs.append(("P3越界", n, (x, y, w, h)))
    # 墙面件必须在墙带内
    for n, x, y, w, h, f, d in WALL:
        if y + h > WALLH: errs.append(("P3墙外", n, y + h))
    # P1 重叠（只查占地件）
    R = rects(FLOOR)
    for i in range(len(R)):
        for j in range(i + 1, len(R)):
            _, ax, ay, aw, ah = R[i]; _, bx, by, bw, bh = R[j]
            ox = min(ax+aw, bx+bw) - max(ax, bx)
            oy = min(ay+ah, by+bh) - max(ay, by)
            if ox > 0 and oy > 0 and ox*oy > min(aw*ah, bw*bh) * 0.10:
                errs.append(("P1重叠", R[i][0] + "×" + R[j][0], (ox, oy)))
    # P2 门口禁区：y>2280 且 x 420..1020 不许有家具
    for n, x, y, w, h in R:
        if y + h > 2280 and x + w > 420 and x < 1020:
            errs.append(("P2门口", n, (x, y)))
    # P4 40px 网格 BFS
    GS = 40
    cols, rows = W // GS, H // GS
    blocked = [[False]*cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if r*GS + GS <= WALLH: blocked[r][c] = True      # 墙带不可走
            if r*GS >= EXT: blocked[r][c] = True             # 延伸带不计
    WALKABLE = {"cushion_round", "popo_door_mat"}
    for n, x, y, w, h in R:
        if n in WALKABLE: continue
        for r in range(max(0, y//GS), min(rows, (y+h)//GS + 1)):
            for c in range(max(0, x//GS), min(cols, (x+w)//GS + 1)):
                blocked[r][c] = True
    free = sum(1 for r in range(rows) for c in range(cols) if not blocked[r][c])
    sr, sc = DOOR[1]//GS, DOOR[0]//GS
    if blocked[sr][sc]:
        errs.append(("P4门口被堵", "DOOR", DOOR))
        seen = set()
    else:
        seen = {(sr, sc)}
        q = deque([(sr, sc)])
        while q:
            r, c = q.popleft()
            for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
                nr, nc = r+dr, c+dc
                if 0 <= nr < rows and 0 <= nc < cols and not blocked[nr][nc] and (nr,nc) not in seen:
                    seen.add((nr,nc)); q.append((nr,nc))
    iso = free - len(seen)
    if iso: errs.append(("P4孤岛", "%d 格不可达" % iso, ""))

    floor_cells = (EXT - WALLH)//GS * cols
    print("件数 墙面 %d + 地面 %d = %d   素材种数 %d"
          % (len(WALL), len(FLOOR), len(all_items),
             len({i[0] for i in all_items})))
    print("空闲格 %d / 地面格 %d = %d%%   可达 %d 格 (%d%%)"
          % (free, floor_cells, free*100//floor_cells, len(seen), len(seen)*100//floor_cells))
    if errs:
        for e in errs[:40]: print("  ✗", e)
        print("\n=== %d 条违规 ===" % len(errs))
        return 1
    print("\n=== 全绿 ===")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
