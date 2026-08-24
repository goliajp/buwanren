-- unmei · postgres init
-- 由 postgres-entrypoint 在首次启动时执行
-- 业务 schema(unmei_*)由 sqlx migrate 在 unmei-api 启动时跑

-- 必备扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid / crypt
CREATE EXTENSION IF NOT EXISTS "citext";     -- 邮箱/openid 不区分大小写存储
-- pg_trgm 给后台模糊检索用
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 时区
SET timezone = 'Asia/Shanghai';

-- 给 unmei 用户授权 schema public
GRANT ALL ON SCHEMA public TO CURRENT_USER;
