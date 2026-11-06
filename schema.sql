-- 站内互动（公告 / 点赞 / 留言）
-- 用法：Cloudflare 控制台 → 存储和数据库 → D1 → 选中库 → 控制台 → 粘贴执行

CREATE TABLE IF NOT EXISTS likes (
  game       TEXT PRIMARY KEY,
  n          INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  body       TEXT NOT NULL,
  game       TEXT,
  created_at TEXT NOT NULL,
  ip_hash    TEXT,
  hidden     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  body       TEXT NOT NULL,
  level      TEXT NOT NULL DEFAULT 'info',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_created ON comments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments (ip_hash, created_at DESC);

-- 三条初始公告（可自行改写 / 置 active=0 下线）
INSERT INTO notices (body, level, active, created_at)
SELECT '攻略站开张：三款游戏 23 篇攻略已上线，留言板同步开放。', 'info', 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM notices);
