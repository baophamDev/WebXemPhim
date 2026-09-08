/**
 * `cachedRoute` / `asyncRoute` — vỏ bọc route trong src/http.ts.
 *
 * Điểm cần giữ: **chỉ câu trả lời thành công mới mang Cache-Control**. Một cái 502
 * nhất thời mà bị trình duyệt cache lại vài phút thì lỗi nhất thời thành lỗi dính,
 * người dùng bấm "thử lại" cũng vô ích — nên đó là thứ đáng có test.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { asyncRoute, cachedRoute } from '../dist/http.js';

/** req/res giả, chỉ đủ những gì hai hàm này chạm tới. */
function fakeRes() {
  const res = {
    headers: {},
    body: undefined,
    jsonCalls: 0,
    header(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; this.jsonCalls += 1; return this; }
  };
  return res;
}

async function run(handler, req = {}) {
  const res = fakeRes();
  let passed = 'chưa gọi next';
  await handler(req, res, (error) => { passed = error; });
  return { res, passed };
}

test('cachedRoute: trả body và gắn Cache-Control theo số giây', async () => {
  const { res, passed } = await run(cachedRoute(60, async () => ({ items: [1, 2] })));
  assert.deepEqual(res.body, { items: [1, 2] });
  assert.equal(res.headers['Cache-Control'], 'public, max-age=60, stale-while-revalidate=300');
  assert.equal(passed, 'chưa gọi next', 'thành công thì không được gọi next()');
});

test('cachedRoute: stale-while-revalidate luôn gấp 5 lần max-age', async () => {
  for (const seconds of [30, 60, 600]) {
    const { res } = await run(cachedRoute(seconds, async () => ({})));
    assert.equal(res.headers['Cache-Control'], `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
  }
});

test('cachedRoute: Vary phải có Origin', async () => {
  // Origin: CORS trả Access-Control-Allow-Origin theo người gọi — thiếu Vary thì
  // cache chung đưa lại header của origin khác và trình duyệt chặn.
  const { res } = await run(cachedRoute(60, async () => ({})));
  assert.equal(res.headers.Vary, 'Origin');
});

test('cachedRoute: handler ném lỗi thì KHÔNG có header cache nào', async () => {
  const boom = new Error('nguồn ngoài chết');
  const { res, passed } = await run(cachedRoute(600, async () => { throw boom; }));
  assert.equal(passed, boom, 'lỗi phải đi sang middleware lỗi qua next()');
  assert.deepEqual(res.headers, {}, 'lỗi nhất thời không được bị cache lại');
  assert.equal(res.jsonCalls, 0, 'không được tự trả body khi lỗi');
});

test('cachedRoute: truyền đúng req cho hàm load', async () => {
  const req = { query: { page: '2', source: 'vsmov' }, params: { slug: 'phim-abc' } };
  let seen = null;
  await run(cachedRoute(60, async (request) => { seen = request; return {}; }), req);
  assert.equal(seen, req);
});

test('cachedRoute: body falsy (null/0/rỗng) vẫn được trả nguyên vẹn', async () => {
  for (const body of [null, 0, '', false, {}]) {
    const { res } = await run(cachedRoute(60, async () => body));
    assert.equal(res.jsonCalls, 1);
    assert.deepEqual(res.body, body);
  }
});

test('asyncRoute: đẩy lỗi sang next() thay vì để promise reject trần', async () => {
  const boom = new Error('vỡ');
  const { passed } = await run(asyncRoute(async () => { throw boom; }));
  assert.equal(passed, boom);
});

test('asyncRoute: handler chạy xong bình thường thì không gọi next()', async () => {
  const { res, passed } = await run(asyncRoute(async (_req, res) => res.json({ ok: true })));
  assert.deepEqual(res.body, { ok: true });
  assert.equal(passed, 'chưa gọi next');
});
