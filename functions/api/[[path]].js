/**
 * Cloudflare Pages Functions —— 站内互动接口（公告 / 点赞 / 留言）
 *
 * 路由（全部在 /api 下，命中本文件的 catch-all）：
 *   GET    /api/notice              公告列表（active=1，最多 3 条）
 *   POST   /api/notice  {text}      发布新公告，顶替旧公告（需 header: x-admin-key）
 *   GET    /api/like                三款游戏的点赞数
 *   POST   /api/like    {game}      点赞 +1
 *   GET    /api/comment?limit=30    留言列表（新→旧，最多 50）
 *   POST   /api/comment {name,body} 发留言
 *   DELETE /api/comment?id=1        删除留言（真删除，需 header: x-admin-key）
 *   DELETE /api/comment?id=hidden   彻底清除所有已隐藏的历史留言（需 header: x-admin-key）
 *
 * 依赖绑定：D1 数据库，变量名 DB（Pages 项目 → 设置 → 绑定 → D1）。
 * 未绑定 DB 时统一返回 503 {error:"backend_not_configured"}，前端据此隐藏模块，不报错。
 */

const GAMES = ['ejl', 'xxtl', 'ty'];
const MAX_NAME = 16;
const MAX_BODY = 300;
const PAGE_MAX = 50;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

/* 只保留可见字符，去掉控制符与零宽字符，压掉连续空白 */
const clean = (s, max) =>
  String(s == null ? '' : s)
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

async function hashIp(request) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown';
  /* 加固定盐：只用于限流去重，无法反推 IP */
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gl-salt-v1:' + ip));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env && env.DB;
  if (!DB) return json({ error: 'backend_not_configured' }, 503);

  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const method = request.method;

  try {
    /* ---------- 公告 ---------- */
    if (route === 'notice') {
      if (method === 'GET') {
        const { results } = await DB.prepare(
          'SELECT id, body, level, created_at FROM notices WHERE active = 1 ORDER BY id DESC LIMIT 3'
        ).all();
        return json({ items: results || [] });
      }
      /* POST：发布新公告（管理用，需 x-admin-key）；
         保留最近 3 条（新公告 + 前 2 条）供前端轮播展示 */
      if (method === 'POST') {
        const key = request.headers.get('x-admin-key') || '';
        if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'forbidden' }, 403);
        const body = await request.json().catch(() => ({}));
        const text = String(body.text || '').trim();
        const level = ['info', 'warn', 'hot'].includes(body.level) ? body.level : 'info';
        if (!text || text.length > 200) return json({ error: 'bad_text' }, 400);
        await DB.prepare(
          'UPDATE notices SET active = 0 WHERE active = 1 AND id NOT IN (SELECT id FROM notices ORDER BY id DESC LIMIT 2)'
        ).run();
        const row = await DB.prepare(
          'INSERT INTO notices (body, level, active, created_at) VALUES (?, ?, 1, datetime(\'now\')) RETURNING id, created_at'
        ).bind(text, level).first();
        return json({ ok: true, item: { id: row.id, body: text, level, created_at: row.created_at } }, 201);
      }
      return json({ error: 'method_not_allowed' }, 405);
    }

    /* ---------- 点赞 ---------- */
    if (route === 'like') {
      if (method === 'GET') {
        const { results } = await DB.prepare('SELECT game, n FROM likes').all();
        const out = {};
        GAMES.forEach((g) => (out[g] = 0));
        (results || []).forEach((r) => {
          if (GAMES.includes(r.game)) out[r.game] = r.n | 0;
        });
        return json({ likes: out });
      }
      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const game = String(body.game || '');
        if (!GAMES.includes(game)) return json({ error: 'bad_game' }, 400);
        const row = await DB.prepare(
          'INSERT INTO likes (game, n, updated_at) VALUES (?, 1, ?) ' +
            'ON CONFLICT(game) DO UPDATE SET n = n + 1, updated_at = excluded.updated_at RETURNING n'
        ).bind(game, new Date().toISOString()).first();
        return json({ game, n: (row && row.n) || 1 });
      }
      return json({ error: 'method_not_allowed' }, 405);
    }

    /* ---------- 留言 ---------- */
    if (route === 'comment') {
      if (method === 'GET') {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 1), PAGE_MAX);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
        const { results } = await DB.prepare(
          'SELECT id, name, body, game, created_at FROM comments WHERE hidden = 0 ORDER BY id DESC LIMIT ? OFFSET ?'
        ).bind(limit, offset).all();
        return json({ items: results || [] });
      }

      if (method === 'POST') {
        const raw = await request.json().catch(() => ({}));
        const name = clean(raw.name, MAX_NAME) || '匿名玩家';
        const body = clean(raw.body, MAX_BODY);
        const game = GAMES.includes(String(raw.game || '')) ? String(raw.game) : '';
        if (body.length < 1) return json({ error: 'empty' }, 400);
        if (body.length > MAX_BODY) return json({ error: 'too_long', max: MAX_BODY }, 400);

        const ipHash = await hashIp(request);
        const now = Date.now();

        /* 限流：同一来源 60 秒 1 条、每天最多 20 条 */
        const last = await DB.prepare(
          'SELECT created_at FROM comments WHERE ip_hash = ? ORDER BY id DESC LIMIT 1'
        ).bind(ipHash).first();
        if (last) {
          const gap = now - new Date(last.created_at).getTime();
          if (gap >= 0 && gap < 60 * 1000) {
            return json({ error: 'too_fast', wait: Math.ceil((60 * 1000 - gap) / 1000) }, 429);
          }
        }
        const today = await DB.prepare(
          'SELECT COUNT(*) AS c FROM comments WHERE ip_hash = ? AND created_at >= ?'
        ).bind(ipHash, new Date(now - 86400000).toISOString()).first();
        if (today && today.c >= 20) return json({ error: 'daily_limit' }, 429);

        const row = await DB.prepare(
          'INSERT INTO comments (name, body, game, created_at, ip_hash, hidden) VALUES (?, ?, ?, ?, ?, 0) RETURNING id, created_at'
        ).bind(name, body, game, new Date(now).toISOString(), ipHash).first();

        return json({ ok: true, item: { id: row.id, name, body, game, created_at: row.created_at } }, 201);
      }

      if (method === 'DELETE') {
        const key = request.headers.get('x-admin-key') || '';
        if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'forbidden' }, 403);
        const raw = (url.searchParams.get('id') || '').trim();
        if (raw === 'hidden') {
          /* 历史版本删除只是标记 hidden=1，行仍留在库里；这里把它们彻底删掉 */
          const res = await DB.prepare('DELETE FROM comments WHERE hidden = 1').run();
          return json({ ok: true, purged: (res.meta && res.meta.changes) || 0 });
        }
        const id = parseInt(raw, 10);
        if (!id) return json({ error: 'bad_id' }, 400);
        /* 删除改为真删除：直接从库里移除，而不是标记 hidden */
        await DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
        return json({ ok: true, deleted: id });
      }

      return json({ error: 'method_not_allowed' }, 405);
    }

    return json({ error: 'not_found' }, 404);
  } catch (err) {
    /* 表还没建时给出可读提示，而不是 500 白屏 */
    const msg = String((err && err.message) || err);
    if (/no such table/i.test(msg)) return json({ error: 'schema_missing' }, 503);
    return json({ error: 'server_error' }, 500);
  }
}
