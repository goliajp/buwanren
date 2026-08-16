# -*- coding: utf-8 -*-
# 严格沿用原手工精灵的规格:12 宽 × 16 高,头(含发/帽)+ 身,无腿
# 字母:K 描边 / F 肤 / H 发 / C 衣 / A 饰 / E 眼 / W 眉 / Y 衣暗 / R 腮
# ── 头(row 0-10):11 行,含发型/帽 + 脸 ──
HEAD = {
   'cathead':"""..K........K..
..KHK....KHK..
..KHFK..KFHK..
..KHHHKKHHHK..
..KHHHHHHHHK..
..KHHFHHFHHK..
..KHHWHHWHHK..
KKKHHHEEHHHKKK
..KHHHKKHHHK..
...KHHHHHHK...
....KKKKKK....""",
      'bun':""".....KHHK.....
..KAAKHHKAAK..
....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'buns':"""...KK....KK...
..KHHK..KHHK..
..KHHHKKHHHK..
...KHHHHHHK...
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
    'witch':""".......KK.....
......KCCK....
.....KCCCK....
....KCCCCK....
...KCCCCCCK...
..KCAAAAAACK..
.KKKKKKKKKKKK.
..KHHFFFFHHK..
..KHFWFFWFHK..
...KFEFFEFK...
....KKKKKK....""",
     'bald':"""....KKKKKK....
...KFHFFHFK...
..KFFFFFFFFK..
..KFHHFFHHFK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
    'short':"""....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'long':"""....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHHFFFFHHK..
..KHFWFFWFHK..
..KHFFFFFFHK..
..KHFEFFEFHK..
...KFFFFFFK...
....KKKKKK....""",
     'hood':"""....KKKKKK....
...KAAAAAAK...
..KAAAAAAAAK..
..KAAFFFFAAK..
..KAFWFFWFAK..
..KAFFFFFFAK..
..KAFEFFEFAK..
..KAKFFFFKAK..
...KAAKKAAK...""",
   'tophat':"""...KAAAAAAK...
...KAAAAAAK...
..KKKKKKKKKK..
...KHHHHHHK...
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
      'cap':"""....KKKKKK....
...KAAAAAAK...
..KKAAAAAAKK..
...KHHHHHHK...
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
   'turban':"""...KAAAAAAK...
..KAAAAAAAAK..
..KAAAAAAAAK..
...KHHHHHHK...
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'veil':"""....KKKKKK....
...KAAAAAAK...
..KAAAAAAAAK..
..KAAFFFFAAK..
..KAFWFFWFAK..
..KAFFFFFFAK..
..KAFEFFEFAK..
..KAKFFFFKAK..
...KAAKKAAK...""",
    'crown':"""...KAAAAAAK...
....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
    'straw':"""....KKKKKK....
..KAAAAAAAAK..
..KKKKKKKKKK..
...KHHHHHHK...
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'wild':"""...KKKKKKKK...
..KHHHHHHHHK..
..KHHHHHHHHK..
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
  'antenna':""".....KAAK.....
....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'horn':"""...KKKKKKKK...
..KHHHHHHHHK..
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'flat':"""..KAAAAAAAAK..
...KKKKKKKK...
...KHHHHHHK...
..KHHHHHHHHK..
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
  'monkhat':"""......KK......
.....KAAK.....
....KAAAAK....
..KKKKKKKKKK..
...KHHHHHHK...
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
  'scholar':"""....KKKKKK....
...KAAAAAAK...
...KKKKKKKK...
...KHHHHHHK...
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'band':"""....KKKKKK....
...KHHHHHHK...
..KHAAAAAAHK..
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
  'ladybun':""".....KHHK.....
....KHHHHK....
....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
     'guan':""".....KAAK.....
....KKAAKK....
...KHHAAHHK...
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
  'oldlady':""".....KHHK.....
....KHHHHK....
....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
   'oldbun':""".....KHHK.....
....KHHHHK....
....KKKKKK....
...KHHHHHHK...
..KHHHHHHHHK..
..KHFFFFFFHK..
..KFWFFFFWFK..
..KFFFFFFFFK..
..KFEFFFFEFK..
...KFFFFFFK...
....KKKKKK....""",
}

# ── 身(row 11-15):5 行 ──
BODY = {
 'plain':"""...KCCCCCCK...
..KCACCCCACK..
..KCCKKKKCCK..
..KYYCCCCYYK..
...KK....KK...""",
 'dao':"""...KCCCCCCK...
..KCCKCCKCCK..
..KCCKKKKCCK..
..KCYYYYYYCK..
...KK....KK...""",
 'robe':"""...KCCCFFFK...
..KACCCCFFFK..
..KAACCCCCFK..
..KYYCCCCCCK..
...KK....KK...""",
 'gown':"""...KCCCCCCK...
..KCACCCCACK..
..KCCKKKKCCK..
..KCAAAAAACK..
.KKCCCCCCCCKK.""",
 'cape':"""..KCACCCCACK..
..KCCCCCCCCK..
..KCCKKKKCCK..
..KYCCCCCCYK..
...KK....KK...""",
 'suit':"""...KCWWWWCK...
..KCCWAAWCCK..
..KCCWWWWCCK..
..KYYCCCCYYK..
...KK....KK...""",
 'shoulder':"""...KCCCFFFK...
..KCCCCCFFFK..
..KACCCCCFFK..
..KYCCCCCCCK..
...KK....KK...""",
}
# id: (head, body, H发, F肤, C衣, A饰, E眼, Y衣暗, W眉)
S = {
 'ayun':   ('bun', 'dao', '#4a3a2c', '#f0c8a0', '#5a7a96', '#a8845a', '#e89080', '#46607a', '#4a3626'),
 'tao':    ('buns','plain','#4a3a2c','#f0c8a0','#e87a90','#e8b23d','#e89080','#c85a70','#4a3626'),
 'popo': ('witch', 'cape', '#e8e0d0', '#e8b888', '#7a5a9a', '#e8b23d', '#c8a080', '#6a4a8a', '#4a3626'),
 'tenz':   ('bald','robe','#3a2c20','#f0c8a0','#a84838','#e8b23d','#4a3626','#8a3a2c','#e89080'),
 'shenyan':   ('scholar','dao','#2a2018','#f0d8b8','#4a6ac8','#2a4a9a','#3a2c20','#3a52a0','#4a3626'),
 'bailu':  ('guan','gown','#4a4238','#f8e4d0','#eef0ea','#5e8e8a','#2a5a6a','#c6cec8','#e0e0dc'),
 'chenjiu': ('cathead','plain','#3a3844','#f0e8e0','#8a4838','#e8b23d','#2a2018','#6a3428','#48c860'),
 'suhe':   ('ladybun','gown','#3a2c20','#f8d8c0','#f0a0c0','#48b890','#8a4a6a','#d07aa0','#4a3626'),
 'leiming': ('wild', 'plain', '#33251a', '#dda878', '#e09030', '#8a5a20', '#3a2c20', '#b06818', '#4a3626'),
 'yanniang': ('oldlady', 'gown', '#c8c4bc', '#dcb090', '#a0487a', '#e8b23d', '#3a2c20', '#7a2c58', '#a8a49c'),
 'laogui': ('hood','cape','#7a6a55','#8aa070','#7a5c38','#c8a868','#2a2018','#5a4028','#a8bc90'),
 'muyi':   ('cap','suit','#2a2018','#f0d0a8','#c89040','#2a4a8a','#5aa8c8','#a06c20','#4a3626'),
 'aluo':   ('short','plain','#5a4028','#e8bc90','#58c048','#e8b23d','#3a6a34','#38a028','#4a3626'),
 'xuanming': ('hood','cape','#2a3a3a','#e8e4d8','#16262a','#c04838','#2a2018','#0e1a1e','#d8b23d'),
 'aying':   ('buns','gown','#3a2c20','#f8d0a8','#f0a028','#e03828','#3a2c20','#c07810','#4a3626'),
 'jiangya':('straw','plain','#c8c4bc','#d09868','#3a8ac8','#e8c060','#3a2c20','#2868a0','#a8a49c'),
 'weila':   ('long','gown','#e8c860','#f8e0c8','#3a5ac8','#e8b23d','#4a7ad8','#2842a0','#c8a840'),
 'rune': ('hood', 'cape', '#d8d8d4', '#dcb894', '#3a6a98', '#a8b8c8', '#6a9ad8', '#2a4a70', '#c0c0bc'),
 'mago':   ('veil','gown','#2a2018','#e8bc90','#d04030','#e8b23d','#3a2c20','#a82818','#4a3626'),
 'sesir':  ('tophat','suit','#4a3020','#f8e0c8','#3a4a6a','#c9a962','#3a2c20','#2a3650','#4a3626'),
 'yisha':   ('long','gown','#2a2018','#f0d0b0','#a04878','#e8b23d','#8a4a7a','#7a2c58','#4a3626'),
 'orlando':('tophat','suit','#4a3a2c','#f8e0c8','#a03850','#e8c860','#3a2c20','#7a1c38','#4a3626'),
 'lilith': ('long', 'gown', '#1a1a22', '#f8ecec', '#3e3050', '#d04888', '#d04888', '#12121a', '#3a3a44'),
 'thomas':   ('hood','cape','#c8a86a','#f0d8b8','#d8c8a8','#8a6a30','#3a2c20','#b0a088','#a88c50'),
 'mira':   ('veil','gown','#2a2018','#d8a878','#c83828','#e8b23d','#3a2c20','#a02818','#4a3626'),
 'kama':   ('crown','cape','#2a2018','#d09868','#2aa878','#e8b23d','#3a2c20','#188858','#4a3626'),
 'aman':   ('turban','cape','#2a2018','#c8945c','#d8c8a0','#a87830','#3a2c20','#b0a080','#4a3626'),
 'engo': ('crown', 'plain', '#1a1a20', '#96654a', '#f0b820', '#e03828', '#3a2c20', '#c89008', '#2a2a30'),
 'rama':   ('turban','cape','#2a2018','#d09868','#f08820','#f8f4e8','#3a2c20','#c86808','#4a3626'),
 'xueyao': ('wild', 'cape', '#f4f0e8', '#d8d0bc', '#a8a498', '#d07828', '#2a2018', '#8a8678', '#e8b23d'),
 'chizuru':   ('ladybun','gown','#1a1a22','#f8e4d0','#f0ece4','#c02020','#3a2c20','#d0c8c0','#3a3a44'),
 'set':    ('flat','cape','#1a1a22','#c88858','#2a5ac8','#e8b23d','#e8b23d','#1a3ea0','#3a3a44'),
 'kdata': ('cap','suit','#8a96a0','#e8e4d8','#8a96a0','#e8b23d','#2a2018','#5a6670','#48e0c8'),
 'xiaoman':   ('antenna','gown','#7ad0f0','#f8ecec','#d8e8f0','#3a9ac8','#4ac0e8','#a8c8d8','#8ac8e0'),
 'laoxu': ('short', 'plain', '#a05038', '#e8c0b0', '#c03838', '#3a2c20', '#2a2018', '#e0d4b8', '#e8dcc0'),
 'cyber': ('wild', 'plain', '#8a5ad8', '#f0d0a8', '#3a3a4a', '#48e070', '#48e070', '#16161e', '#6a3ab0'),
 'ami':   ('long','gown','#f0c848','#f8e4d0','#f090b8','#e8b23d','#d07a98','#d06898','#c8a020'),
 'barista':('cap','plain','#3a2c20','#f0d0a8','#8a5a3a','#f0e0c0','#3a2c20','#6a3e22','#4a3626'),
 'courier':('cap','plain','#2a2018','#e0b088','#38a858','#f0c828','#3a2c20','#208840','#4a3626'),
 'anonymous': ('hood','cape','#26262e','#26262e','#44444f','#5c5c6e','#d8e4f0','#33333c','#3a3a46'),
}
OUT = {
 'chenjiu':'#18161e',   # 描边色 override:深色角色用浅描边,否则黑衣+黑边糊成剪影
 'xuanming':'#6a7a7e', 'lilith':'#7a6288', 'cyber':'#5e5e78', 'anonymous':'#7a7a8c',
}
EYES = {
 'chenjiu':'#14121a',
 'laoxu':'#e8b23d',
 'xuanming':'#d8b23d',
 'anonymous':'#d8e4f0',
 'cyber':'#48e070', 'lilith':'#d04888', 'set':'#1a1a22', 'xiaoman':'#4ac0e8',
 'kdata':'#48e0c8', 'xueyao':'#f8cc50', 'muyi':'#5aa8c8', 'anonymous':'#d8e4f0',
 'bailu':'#2a5a6a', 'weila':'#4a7ad8', 'rune':'#6a9ad8', 'aluo':'#3a6a34',
}
FACE_OF = {
 'ayun':'closed','tao':'normal','popo':'squint','tenz':'plain',
 'shenyan':'normal','bailu':'normal','chenjiu':'normal','suhe':'normal',
 'leiming':'beard','yanniang':'squint','laogui':'closed','muyi':'shade',
 'aluo':'normal','xuanming':'closed','aying':'normal','jiangya':'beard',
 'weila':'plain','rune':'stern','mago':'normal','sesir':'mono',
 'yisha':'plain','orlando':'mono','lilith':'plain','thomas':'closed',
 'mira':'normal','kama':'stern','aman':'beard','engo':'normal',
 'rama':'closed','xueyao':'plain','chizuru':'normal','set':'stern',
 'kdata':'shade','xiaoman':'normal','laoxu':'squint','cyber':'shade',
 'ami':'normal','barista':'squint','courier':'normal','anonymous':'plain',
}
def apply_face(rows, v):
    """脸部行(含 W=眼 / E=腮红)按性格改造"""
    r = [list(x) for x in rows]
    wi = next((i for i,x in enumerate(rows) if 'W' in x), None)
    ei = next((i for i,x in enumerate(rows) if 'E' in x), None)
    if wi is None: return rows
    W = [i for i,ch in enumerate(rows[wi]) if ch=='W']
    if v == 'plain' and ei is not None:                       # 无腮红
        r[ei] = [('F' if ch=='E' else ch) for ch in r[ei]]
    elif v == 'closed':                                       # 闭眼(横线)
        for i in W:
            r[wi][i] = 'K'
            j = i+1 if i < 6 else i-1
            if 0 <= j < len(r[wi]) and r[wi][j]=='F': r[wi][j]='K'
    elif v == 'squint':                                       # 眯眼(细横)
        for i in W: r[wi][i] = 'K'
        if ei is not None: pass                               # 保留腮红
    elif v == 'shade':                                        # 墨镜
        f = [i for i,ch in enumerate(rows[wi]) if ch in 'FW']
        for i in f: r[wi][i] = 'K'
        if ei is not None: r[ei] = [('F' if ch=='E' else ch) for ch in r[ei]]
    elif v == 'beard' and ei is not None:                     # 胡子只占下巴中段,两侧留肤色
        ci = ei + 1
        if ci < len(r):
            idx = [i for i,ch in enumerate(r[ci]) if ch == 'F']
            for i in idx[1:-1]: r[ci][i] = 'H'
    elif v == 'mono':                                         # 单片镜(右眼)
        if W: r[wi][W[-1]] = 'A'
        if len(W)>1 and W[-1]+1 < len(r[wi]) and r[wi][W[-1]+1]=='F': r[wi][W[-1]+1]='A'
    elif v == 'stern' and ei is not None:                     # 严肃 = 无腮红(不画嘴,12×16 画嘴必丑)
        r[ei] = [('F' if ch=='E' else ch) for ch in r[ei]]
    return [''.join(x) for x in r]

# ── 轮廓算子:对称收缩 / 对称外扩(保持 12 宽、中心 6.5、K 描边)──
# ── 兽形角色:不走「头饰 + 身体」的人形骨架,整块绘制 ──
# 名字与流派本就指向动物:老龟(灼甲 · 龟甲就是他自己的壳)、雪鸮(击鼓的萨满 · 鸮 = 猫头鹰)
ANIMAL = {
 # 老龟 · 灼甲的人 —— 龟甲卜的那块甲,就是他自己的壳
 'laogui': """..............
..............
....KKKKKK....
...KFFFFFFK...
...KFWFFWFK...
...KFFFFFFK...
....KFFFFK....
.....KKKK.....
..KKKKKKKKKK..
.KCCCKCCKCCCK.
.KCCCKCCKCCCK.
.KKKKKKKKKKKK.
.KCCCKCCKCCCK.
.KKCCCCCCCCKK.
..KKK....KKK..
..............""",
 # 雪鸮 · 击鼓的萨满 —— 鸮 = 猫头鹰
 'xueyao': """..............
...KK....KK...
..KHHK..KHHK..
..KHHHKKHHHK..
.KHHHHHHHHHHK.
.KHFWWFFWWFHK.
.KHFWWFFWWFHK.
.KHHHHAAHHHHK.
.KHHHHHHHHHHK.
.KCCHHHHHHCCK.
.KCCHHHHHHCCK.
.KCCHHHHHHCCK.
..KCHHHHHHCK..
...KKKAAKKK...
..............
..............""",
 # 玄冥 · 隐者 —— 北方之神玄武 = 龟蛇合体。他与老龟「同门」:一个不说话,一个不出现
 'xuanming': """..............
.....KKKK.....
....KHHHHK....
....KWHHWK....
....KHHHHK....
....KHAAHK....
...KKHHHHKK...
..KCCHHHHCCK..
.KCCCHHHHCCCK.
.KCCCCHHCCCCK.
.KKCCCCCCCCKK.
..KKCCCCCCKK..
...KKHHHHKK...
....KKHHKK....
.....KKKK.....
..............""",
 # K · 数据占卜师 —— 屏幕为脸,LED 为眼
 'kdata': """......KK......
....KKKKKK....
...KCCCCCCK...
...KCWWWWCK...
...KCWWWWCK...
...KCCCCCCK...
....KKKKKK....
.....KAAK.....
..KKCCCCCCKK..
.KCCCCCCCCCCK.
.KCCCAAAACCCK.
.KCCCCCCCCCCK.
.KCCKKKKKKCCK.
..KKCCCCCCKK..
...KKK..KKK...
..............""",
 # 老徐 · K 线上的神 —— 亢奋/迷信,一头牛市的牛
 'laoxu': """..............
.KK........KK.
KYYK......KYYK
.KYYKKKKKKYYK.
..KHHHHHHHHK..
..KHWHHHHWHK..
..KHHHHHHHHK..
...KHFFFFHK...
...KFFAAFFK...
....KFFFFK....
.....KKKK.....
..KKCCCCCCKK..
.KCCCCCCCCCCK.
.KCCCAAAACCCK.
..KKCCCCCCKK..
...KK....KK...""",
}

def _span(r):
    idx = [i for i,ch in enumerate(r) if ch != '.']
    return (idx[0], idx[-1]) if idx else None

def _inset(r):
    """左右各收 1 格"""
    sp = _span(r)
    if not sp: return r
    l, rr = sp
    if rr - l < 7: return r          # span < 8 不再收 —— 否则窄肩(gown)会收成漏斗
    core = r[l+1:rr]
    return '.'*(l+1) + 'K' + core[1:-1] + 'K' + '.'*(len(r)-rr)

def _outset(r):
    """左右各扩 1 格(内部有空隙的行 —— 如两条腿 —— 不动)"""
    sp = _span(r)
    if not sp: return r
    l, rr = sp
    if l == 0 or rr == len(r)-1: return r
    if '.' in r[l:rr+1]: return r          # 腿行等有内部空隙,扩会破形
    fill = r[l+1]
    if fill == 'K': fill = r[l+2] if l+2 <= rr-1 else 'K'
    return '.'*(l-1) + 'K' + fill + r[l+1:rr] + fill + 'K' + '.'*(len(r)-rr-2)

# ── 脸型:改造下巴轮廓(仅当末行是纯描边下巴时生效,兜帽/面纱等不动)──
SHAPE = {
 'ayun':'round','tao':'chubby','popo':'round','tenz':'square','shenyan':'slim',
 'bailu':'slim','chenjiu':'round','suhe':'round','leiming':'square','yanniang':'slim',
 'laogui':'square','muyi':'slim','aluo':'chubby','xuanming':'slim','aying':'chubby',
 'jiangya':'square','weila':'slim','rune':'square','mago':'chubby','sesir':'slim',
 'yisha':'slim','orlando':'slim','lilith':'slim','thomas':'round','mira':'round',
 'kama':'square','aman':'square','engo':'square','rama':'round','xueyao':'round',
 'chizuru':'chubby','set':'square','kdata':'slim','xiaoman':'chubby','laoxu':'round',
 'cyber':'slim','ami':'chubby','barista':'chubby','courier':'chubby','anonymous':'slim',
}

def apply_shape(rows, v):
    if v in (None, 'round') or len(rows) < 3: return rows
    r = list(rows)
    if set(r[-1]) != {'.', 'K'}: return rows      # 兜帽/面纱下沿 —— 不是下巴,不动
    # 关键:四种脸型都不改脸宽(12 格里脸已占满,再撑就成方砖),只改下巴轮廓
    if v == 'square':                             # 方下巴:底边平宽,硬转角
        r[-1] = _outset(r[-1])
    elif v == 'slim':                             # 瘦长脸:整脸收窄,五官跟着内移(只挪描边会把眼睛挤成眼窝)
        wi = next((i for i,x in enumerate(r) if 'W' in x), None)
        if wi is None or wi < 1 or len(r) - (wi-1) != 6: return rows
        # 脸上方的满宽发行也得跟着收 —— 否则头发比脸宽一格,在耳朵位置支棱出来像耳罩
        top = []
        for x in rows[:wi-1]:
            sp = _span(x)
            if sp and sp[0] == 2 and sp[1] == len(x) - 3: x = _inset(x)
            top.append(x)
        return top + [
            '...KHFFFFHK...',
            '...KFWFFWFK...',
            '...KFFFFFFK...',
            '...KFEFFEFK...',
            '....KFFFFK....',
            '....KKKKKK....']
    elif v == 'chubby':                           # 婴儿肥:脸颊鼓出,下巴仍圆收
        r[-2] = _outset(r[-2])
    return r

# ── 身材:改造肩宽 / 腿宽 ──
BUILD = {
 'laogui':'fat','engo':'fat','jiangya':'fat','aman':'fat','rama':'fat','mago':'fat','leiming':'fat',
 'bailu':'thin','xuanming':'thin','shenyan':'thin','lilith':'thin','sesir':'thin','yisha':'thin',
 'kdata':'thin','anonymous':'thin','muyi':'thin','weila':'thin','cyber':'thin','ayun':'thin',
}

def apply_build(rows, v):
    if v in (None, 'norm'): return rows
    if v == 'thin':  return [_inset(x) for x in rows]
    if v == 'fat':   return [_outset(rows[0])] + list(rows[1:])   # 肩撑到与身同宽 = 没脖子
    return rows

def css(cid, cell=3):
    hd, bd, H, F, C, A, E, Y, W = S[cid]
    if cid in ANIMAL:
        rows = ANIMAL[cid].split('\n')
        pal = {'K':OUT.get(cid,'#3a2c20'),'H':H,'F':F,'C':C,'A':A,'W':EYES.get(cid,'#2a2018'),'E':'#e89080','Y':Y}
        sh = []
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch in ('.', ' '): continue
                sh.append('%dpx %dpx 0 0 %s' % (c*cell, r*cell, pal.get(ch, '#3a2c20')))
        return ('  .spr-%s { position: relative; width: %dpx; height: %dpx; }\n'
                '  .spr-%s::after { content: ""; position: absolute; top: 0; left: 0; width: %dpx; height: %dpx; box-shadow: %s; }\n'
                % (cid, 14*cell, 16*cell, cid, cell, cell, ', '.join(sh)))
    hrows = HEAD[hd].split('\n')
    while hrows and set(hrows[0]) <= {'.'}: hrows.pop(0)
    while hrows and set(hrows[-1]) <= {'.'}: hrows.pop()
    hrows = apply_shape(hrows, SHAPE.get(cid, 'round'))
    hrows = apply_face(hrows, FACE_OF.get(cid, 'normal'))
    brows = apply_build(BODY[bd].split('\n'), BUILD.get(cid, 'norm'))
    rows = hrows + brows
    rows = ['.' * 14] * (16 - len(rows)) + rows
    # W = 眼睛(深) · E = 腮红(浅红)
    # W = 眼睛(默认黑,特殊角色有异色) · E = 腮红(浅红)
    eye = EYES.get(cid, '#2a2018')
    pal = {'K':OUT.get(cid,'#3a2c20'),'H':H,'F':F,'C':C,'A':A,'W':eye,'E':'#e89080','Y':Y,'R':'#e87a98'}
    sh = []
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch in ('.', ' '): continue
            sh.append('%dpx %dpx 0 0 %s' % (c*cell, r*cell, pal.get(ch, '#3a2c20')))
    return ('  .spr-%s { position: relative; width: %dpx; height: %dpx; }\n'
            '  .spr-%s::after { content: ""; position: absolute; top: 0; left: 0; width: %dpx; height: %dpx; box-shadow: %s; }\n'
            % (cid, 14*cell, 16*cell, cid, cell, cell, ', '.join(sh)))
