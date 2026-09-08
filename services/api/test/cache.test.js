/**
 * Cache server trong src/cache.ts + `serverCachedRoute` trong src/http.ts.
 *
 * Chạy trên backend RAM (không đặt REDIS_URL lúc test) nên không cần Redis thật.
 * Điểm cần giữ:
 * - Lần 2 ăn HIT mà không gọi loader (không chạm DB/nguồn ngoài lần nữa).
 * - Loader ném lỗi thì không có gì được ghi vào cache, và lỗi đi sang next().
 * - Khoá route không phụ thuộc thứ tự query string.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheGet, cacheSet, routeKey } from '../dist/cache.js';
import { serverCachedRoute } from '../dist/http.js';

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

test('cache RAM: set rồi get lại đúng giá trị', async () => {
  await cacheSet('web:test:roundtrip', 'xin-chao', 60);
  assert.equal(await cacheGet('web:test:roundtrip'), 'xin-chao');
});

test('cache RAM: miss trả null', async () => {
  assert.equal(await cacheGet('web:test:khong-co-key-nay'), null);
});

test('cache RAM: hết TTL thì coi như miss', async () => {
  await cacheSet('web:test:ttl', 'tam', 0.05);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(await cacheGet('web:test:ttl'), null);
});

test('routeKey: cùng query khác thứ tự thì cùng một khoá', () => {
  const a = routeKey('catalog:home', { page: '1', limit: '24' });
  const b = routeKey('catalog:home', { limit: '24', page: '1' });
  assert.equal(a, b);
});

test('routeKey: khác param thì khác khoá', () => {
  assert.notEqual(routeKey('catalog:home', { page: '1' }), routeKey('catalog:home', { page: '2' }));
});

test('serverCachedRoute: MISS lần đầu, HIT lần sau không gọi loader', async () => {
  let calls = 0;
  const handler = serverCachedRoute(60, () => 'web:test:hit-miss', async () => {
    calls += 1;
    return { items: [calls] };
  });
  const first = await run(handler, { query: {}, params: {} });
  assert.equal(first.res.headers['X-Cache'], 'MISS');
  assert.deepEqual(first.res.body, { items: [1] });
  const second = await run(handler, { query: {}, params: {} });
  assert.equal(second.res.headers['X-Cache'], 'HIT');
  assert.deepEqual(second.res.body, { items: [1] });
  assert.equal(calls, 1, 'HIT không được gọi loader lần nữa');
});

test('serverCachedRoute: vẫn giữ Cache-Control + Vary như cachedRoute', async () => {
  const handler = serverCachedRoute(30, () => 'web:test:headers', async () => ({}));
  const { res } = await run(handler, { query: {}, params: {} });
  assert.equal(res.headers['Cache-Control'], 'public, max-age=30, stale-while-revalidate=150');
  assert.equal(res.headers.Vary, 'Origin');
});

test('serverCachedRoute: loader lỗi thì sang next() và không cache', async () => {
  const boom = new Error('DB nghẽn');
  let calls = 0;
  const handler = serverCachedRoute(60, () => 'web:test:loi', async () => {
    calls += 1;
    throw boom;
  });
  const first = await run(handler, { query: {}, params: {} });
  assert.equal(first.passed, boom);
  assert.deepEqual(first.res.headers, {}, 'lỗi không được mang header cache');
  const second = await run(handler, { query: {}, params: {} });
  assert.equal(second.passed, boom);
  assert.equal(calls, 2, 'lỗi không được ghi cache nên lần sau phải tính lại');
});
