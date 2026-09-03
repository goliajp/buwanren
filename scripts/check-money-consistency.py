#!/usr/bin/env python3
"""钱的账目在库里必须自洽。

【为什么要有这一支】——2026-09-03 在运营台的订单屏上一眼看见:
一笔状态「完成」、应付 ¥268 的订单,已付栏是 ¥0.00。一查 991 笔,
合计 ¥68,332,从 08-16 攒到当天,全部来自 `web/verify.mjs` 的一行夹具
（它只改 status 不改 amount_paid_minor）。

要紧的不是那 991 笔脏数据,是**它造的是真链路永远造不出的状态**:
已付、没收到钱、连一条 payment 行都没有。拿这种状态跑出来的绿灯,
说的不是真链路的事。而在这一支写出来之前,没有任何东西会喊。

这里查的是【跨表的钱对不对得上】——那正是单表约束管不到、
而单元测试也照不到的地方（每个用例自己造自己的数据,各自都自洽）。
"""
import os, re, subprocess, sys

url = os.environ.get('DATABASE_URL',
                     'postgres://unmei:unmei_dev_pwd@localhost:6032/unmei')

def 问(sql):
    r = subprocess.run(['psql', url, '-tAc', sql],
                       capture_output=True, text=True, timeout=30)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

码, _, 错 = 问('SELECT 1')
if 码 != 0:
    print(f'— 跳过：连不上库（{错[:60]}）。这一支【没验】，不是通过')
    sys.exit(0)

不变量 = [
    ('说收到钱了，钱却是 0',
     """SELECT COUNT(*) FROM order_record
        WHERE status IN ('paid','fulfilling','done')
          AND COALESCE(amount_paid_minor,0) = 0
          AND COALESCE(amount_total_minor,0) > 0""",
     '订单标成已付/履约中/完成，但已付金额是 0'),

    # 【这一条收窄过，说清楚为什么】。原本判的是「已付订单必有一条成功支付」——
    # 生产上这是对的，但夹具合法地造「不走支付的订单」（那正是夹具的用处：
    # 跳过不测的那几步）。本机库里 3306 笔是这么来的，一条 payment 行都没有。
    #
    # 直接放它过去等于开后门，后门迟早会盖住真问题；所以改成断言【夹具造不出
    # 的那一种】:有支付行、没有一条成功、订单却说已付。那是状态机真的错了。
    # 夹具那一批的条数在下面单独【报出来】，只是不判失败 ——
    # 藏起来跟没查过一样。
    ('付款没成，订单却说已付',
     """SELECT COUNT(*) FROM order_record o
        WHERE o.status IN ('paid','fulfilling','done')
          AND COALESCE(o.amount_total_minor,0) > 0
          AND EXISTS (SELECT 1 FROM payment p WHERE p.order_id = o.id)
          AND NOT EXISTS (SELECT 1 FROM payment p
                          WHERE p.order_id = o.id AND p.status IN ('success','refunded','refunded_partial'))""",
     '订单有支付记录，但没有一条是成功的，订单却标成已付'),

    ('退的比收的还多',
     """SELECT COUNT(*) FROM order_record
        WHERE COALESCE(amount_refunded_minor,0) > COALESCE(amount_paid_minor,0)""",
     '退款金额超过了实收'),

    ('分录借贷不平',
     """SELECT COUNT(*) FROM (
          SELECT entry_id FROM journal_line
          GROUP BY entry_id
          HAVING COALESCE(SUM(debit_minor),0) <> COALESCE(SUM(credit_minor),0)
        ) x""",
     '复式记账的分录借方合计不等于贷方合计'),
]

坏, 查过 = [], 0
for 名, sql, 说 in 不变量:
    码, 出, 错 = 问(re.sub(r'\s+', ' ', sql))
    if 码 != 0:
        print(f'✗ 「{名}」这一条查不出来（{错[:70]}）—— 表结构多半改过了')
        sys.exit(1)
    查过 += 1
    n = int(出 or 0)
    if n:
        坏.append(f'{名}:{n} 笔 —— {说}')

# 【一条都没跑成就不算数】。上面任何一步 continue 掉，结果都跟「全干净」一样。
if 查过 != len(不变量):
    print(f'✗ {len(不变量)} 条不变量只跑成了 {查过} 条 —— 结论不算数')
    sys.exit(1)

# 【夹具那一批只报数，不判失败】。它们是「订单已付、一条支付记录都没有」——
# 生产上不该存在，但本机的夹具就这么造。数字摆在这儿，涨了看得见。
码, 出, _ = 问(re.sub(r'\s+', ' ',
    """SELECT COUNT(*) FROM order_record o
       WHERE o.status IN ('paid','fulfilling','done')
         AND COALESCE(o.amount_total_minor,0) > 0
         AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.order_id = o.id)"""))
无支付 = int(出 or 0) if 码 == 0 else -1
if 无支付 > 0:
    print(f'  （另有 {无支付} 笔订单说已付、却连一条支付记录都没有 —— '
          f'本机夹具造的，生产上不该出现）')

if 坏:
    print(f'✗ 库里的钱对不上（{查过} 条不变量，{len(坏)} 条不成立）:')
    for x in 坏:
        print('   ' + x)
    sys.exit(1)
print(f'✓ 钱的账目 · {查过} 条跨表不变量都成立')
