// webadmin 浏览器冒烟 · 通知条真实渲染验证
//
// 场景:运营打开一笔 unpaid 订单的详情,点「取消订单」;点击瞬间订单已在库里
// 被推进到 done(真实竞态)。期望:后端 409,右下角出现「状态流转不允许 · …」,
// 8 秒 TTL 后自动消失;合法取消则静默成功(列表刷新即反馈,不弹窗)。
//
// 前置:pg(6032)+ unmei-admin-api(6029)+ webadmin vite dev(6030)都在跑:
//   bash scripts/setup-dev.sh
//   cd backend && cargo run -p unmei-admin-api &
//   cd webadmin && npm run dev &
// 运行:bun scripts/browser-smoke.mjs        (SHOT_DIR=/tmp 可存截图)
// 依赖:bun + playwright(chromium)+ 一个能连的库(PSQL_URL 或本机 docker 容器)
// ⚠ 会写数据(两笔订单 + 一个用户),跑完自己清掉。对 dev 库跑。
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

/* 连库两条路：给了 PSQL_URL 就直连（CI 的库是 service container，
   没有名叫 unmei-postgres 的容器可 exec）；没给就退回本机那个容器。
   `verify-semantics.sh` 早就是这么写的 —— 这一支当初漏了，
   于是它只能在本机跑，CI 里根本没有它。 */
const PSQL_URL = process.env.PSQL_URL || process.env.DATABASE_URL || '';
/* 地址从参数来，别写死。写死的话它只能验 6030 上那个 ——
   而 vite 的端口是调用方定的（`webadmin-verify.sh` 用 WEBADMIN_PORT）。 */
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7)
  || 'http://localhost:6030';
const psql = (sql) =>
  execSync(
    PSQL_URL
      ? `psql "${PSQL_URL}" -tA -c "${sql.replace(/"/g, '\\"')}"`
      : `docker exec -i unmei-postgres psql -U unmei -d unmei -tA -c "${sql.replace(/"/g, '\\"')}"`,
  )
    .toString().trim();

const SHOT = process.env.SHOT_DIR;
const fail = (msg) => { console.error('✗', msg); process.exit(1); };

// ─── 造数据:一笔 cn region 的 unpaid 订单,置顶(created_at 最新)───
const uid = 'u_notice_' + Date.now();
const oid = 'ord-notice-' + Date.now();
psql(`INSERT INTO app_user(id, nickname, platform, region) VALUES ('${uid}','通知条实测','web','cn')`);
psql(`INSERT INTO order_record(id, user_id, channel_origin, currency, amount_subtotal_minor,
      amount_total_minor, status, source_kind, region, expires_at, created_at)
      VALUES ('${oid}','${uid}','web','CNY',19900,19900,'unpaid','one_shot','cn',
      NOW() + INTERVAL '30 minutes', NOW())`);
console.log('· 造单', oid);

/* 用 Playwright 自带的 chromium，【不要】装机版 Chrome。
   08-30 实测：`channel: 'chrome'` 拉起来的进程活二三十秒就挨 SIGKILL ——
   不是崩（没有崩溃报告）、也不是内存（当时空着 67%）。同一台机器同一份页面，
   自带 chromium 连跑 30 轮 46 秒无事，装机版 22 轮就没。差别只有这一个开关。
   机器上跑着 GoogleUpdater，而它更新时会清掉所有共用那个 app bundle 的实例。
   症状很难认：门禁连着报红，而失败账是空的（一条断言都没红），
   于是「跑不完」跟「动线断了」在总账上长得一模一样。
   验证工具本来就不该押在用户那份浏览器上 —— 自带的这份就是为可复现装的。 */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15000);

// prompt('取消理由?') 是原生对话框
page.on('dialog', (d) => d.accept('浏览器实测'));

// ─── 登录 ───
await page.goto(BASE + '/login');
await page.getByPlaceholder(/email|邮箱/i).or(page.locator('input[type="email"], input[type="text"]').first()).fill('admin@unmei.local');
await page.locator('input[type="password"]').fill('admin123');
await page.locator('button[type="submit"], button:has-text("登录"), button:has-text("Login")').first().click();
await page.waitForURL((u) => !u.pathname.includes('login'));
console.log('· 登录成功');

// ─── Orders 页 → 打开详情抽屉 ───
await page.goto(BASE + '/orders');
const row = page.locator(`tr:has-text("${oid.slice(-4)}")`).first(); // 列表用 shortId 截断,拿尾 4 位匹配
await row.waitFor();
await row.locator('button').last().click(); // Eye 详情按钮
const cancelBtn = page.locator('button:has-text("取消订单")');
await cancelBtn.waitFor();
if (await cancelBtn.isDisabled()) fail('unpaid 订单的取消按钮不该置灰');
console.log('· 详情抽屉打开，取消按钮可点');

// ─── 竞态:点击前把订单推进到 done ───
psql(`UPDATE order_record SET status='done', paid_at=NOW(), amount_paid_minor=19900, fulfilled_at=NOW() WHERE id='${oid}'`);
console.log('· 库里已把订单推进到 done（UI 尚未刷新）');

await cancelBtn.click();

// ─── 断言:通知条出现且文案正确 ───
const notice = page.locator('[role="status"]');
await notice.waitFor({ timeout: 8000 });
const text = (await notice.innerText()).trim();
console.log('· 通知条文案：', JSON.stringify(text));
if (!text.includes('状态流转不允许')) fail('缺中文说法');
if (!text.includes('illegal state transition')) fail('缺原始文案(排查要靠它)');
if (SHOT) await page.screenshot({ path: `${SHOT}/notice-shown.png` });

// ─── 断言:8 秒 TTL 后自动消失 ───
await page.waitForTimeout(8500);
if (await notice.count() > 0 && await notice.first().isVisible().catch(() => false))
  fail('通知条 8 秒后应自动消失');
console.log('· 通知条已按 TTL 自动消失');

// ─── 反向对照:合法取消成功、不弹错误 ───
const oid2 = 'ord-notice2-' + Date.now();
psql(`INSERT INTO order_record(id, user_id, channel_origin, currency, amount_subtotal_minor,
      amount_total_minor, status, source_kind, region, expires_at, created_at)
      VALUES ('${oid2}','${uid}','web','CNY',100,100,'unpaid','one_shot','cn',
      NOW() + INTERVAL '30 minutes', NOW())`);
await page.goto(BASE + '/orders');
const row2 = page.locator(`tr:has-text("${oid2.slice(-4)}")`).first();
await row2.waitFor();
await row2.locator('button').last().click();
await page.locator('button:has-text("取消订单")').click();
await page.waitForTimeout(1500);
if (await page.locator('[role="status"]').count() > 0) fail('成功路径不该弹任何通知(列表刷新即反馈)');
const st = psql(`SELECT status FROM order_record WHERE id='${oid2}'`);
if (st !== 'cancelled') fail(`合法取消应生效,实际 status=${st}`);
console.log('· 合法取消成功且无弹窗，库内状态 cancelled ✓');

await browser.close();
// 清数据
psql(`DELETE FROM order_record WHERE id IN ('${oid}','${oid2}')`);
psql(`DELETE FROM app_user WHERE id='${uid}'`);
console.log('\n✅ 通知条浏览器实测全部通过');
