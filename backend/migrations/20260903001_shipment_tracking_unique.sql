-- 一个运单号只对一张运单（2026-09-03 第四轮评审 · 工程审计）
--
-- `apply_trace_webhook` 按 `(carrier_code, tracking_no)` 定位运单，用的是
-- `fetch_optional` —— 也就是「取一条」。而这两列上没有任何唯一约束:
-- 库里 `(sf, SF123456)` 有 201 张运单、`(sf, SFVERIFY001)` 有 90 张。
-- 承运商回调进来时，它改到的是【随机】一张 —— 审计伪造回调那次，
-- 改中的就是随机的一张。
--
-- 现实世界里一个承运商的一个单号只对应一件包裹，这是事实，不是约定;
-- 让库来保证它，代码那一侧的 `fetch_optional` 才配得上「取一条」这个意思。
--
-- 清理:每组只留最早的那一张，其余的把 tracking_no 置空
-- （不删行 —— 那些运单挂着真实的订单与轨迹，删了会连带断掉外键）。
-- 置空之后它们回到「还没有单号」，跟没发货的运单同一个状态，
-- 后台补单号时会重新走 assign_tracking。
UPDATE shipment SET tracking_no = NULL
 WHERE id IN (
   SELECT id FROM (
     SELECT id, ROW_NUMBER() OVER (
              PARTITION BY carrier_code, tracking_no ORDER BY created_at, id) AS rn
       FROM shipment WHERE tracking_no IS NOT NULL
   ) t WHERE rn > 1
 );

-- 部分唯一索引 —— 没有单号的那些（还没发货）不参与
DROP INDEX IF EXISTS uq_shipment_tracking;
CREATE UNIQUE INDEX uq_shipment_tracking
    ON shipment (carrier_code, tracking_no)
 WHERE tracking_no IS NOT NULL;
