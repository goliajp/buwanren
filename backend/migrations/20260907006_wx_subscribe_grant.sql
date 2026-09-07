-- 订阅消息的授权：用户点过一次「允许」，我们就能发一条。
--
-- 【小程序的推送只有这一种】。它不是「推送通知」——用户必须**每一条都
-- 单独授权**（`wx.requestSubscribeMessage`），授权一次只能发一条。
-- 所以「有没有授权、用掉没有」是要落库的事，不是一个布尔开关。
--
-- 【为什么现在才有】。`wx_message_log` 那张表从建库起就在，
-- 而全仓只有注销那一处在删它 —— 建了表、没有人写。
-- 而 2026-09-07 之后按月送变成了「每期开单、你来付」：
-- 人不打开 app 就不知道该付了，这条路成了必需品。
CREATE TABLE IF NOT EXISTS wx_subscribe_grant (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  openid      text NOT NULL,
  template_id text NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  -- 用掉了就是用掉了。微信那一侧一次授权只发得出一条
  used_at     timestamptz,
  region      text NOT NULL DEFAULT 'cn'
);

-- 找「这个人这条模板还有没有没用掉的授权」——发之前问的就是这一句
CREATE INDEX IF NOT EXISTS idx_wx_grant_unused
  ON wx_subscribe_grant (user_id, template_id) WHERE used_at IS NULL;

COMMENT ON TABLE wx_subscribe_grant IS
  '订阅消息授权。一次授权发一条，发过就把 used_at 填上';
