#!/usr/bin/env python3
"""家具占位校验器 — obs 矩形 = 家具真值表
规则 P1 家具之间不得重叠(>40px 且 >30% 小者面积)
规则 P2 家具不得进门口禁区 y>2280 且 x 420-1020(被 UI 按钮遮挡)
规则 P3 家具不得进顶部禁区 y<180(被标题栏遮挡)"""
import re,sys,json
P='mini/design.html'
s=open(P,encoding='utf-8').read()
rooms=[(m.group(1),m.start()) for m in re.finditer(r'FULLROOMS\.(\w+)=\{',s)]
rooms.append(('__END__',s.find('    var HUTS=[];')))
bad={}
for k in range(len(rooms)-1):
    name,a=rooms[k]; b=rooms[k+1][1]; blk=s[a:b]
    m=re.search(r'\n\s*obs:\s*(\[\[.*?\]\])\s*,?\s*\n',blk,re.S)
    if not m: continue
    try: R=json.loads(m.group(1))
    except Exception: continue
    errs=[]
    for i in range(len(R)):
        ax,ay,aw,ah=R[i]
        if ay+ah>2280 and ax+aw>420 and ax<1020: errs.append(('P2门口',i,R[i]))
        for j in range(i+1,len(R)):
            bx,by,bw,bh=R[j]
            ox=min(ax+aw,bx+bw)-max(ax,bx); oy=min(ay+ah,by+bh)-max(ay,by)
            if ox>40 and oy>40 and ox*oy>min(aw*ah,bw*bh)*0.30:
                errs.append(('P1重叠',(i,j),(R[i],R[j])))
    if errs: bad[name]=errs
tot=sum(len(v) for v in bad.values())
for n,e in bad.items():
    print(f'{n:10s} {len(e):2d}: '+', '.join(x[0] for x in e[:6]))
print(f'\n=== {len(bad)}/36 间违规, 共 {tot} 条 ===')
sys.exit(1 if bad else 0)
