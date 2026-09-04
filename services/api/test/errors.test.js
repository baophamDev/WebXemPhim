/**
 * Chốt cái quan trọng nhất của `errors.ts`: message của hạ tầng không được rò ra
 * ngoài, trong khi lỗi của chính request vẫn phải nói thẳng để người gọi sửa được.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, describeFailure, httpError, shortCause } from '../dist/errors.js';

/** Dựng lỗi kiểu Node/undici: lỗi thật nằm trong `cause`. */
const fetchFailed = (cause) => Object.assign(new TypeError('fetch failed'), { cause });

test('zod: trả nguyên văn thông điệp của issue đầu tiên', () => {
  const failure = describeFailure({ issues: [{ message: 'Số trang không hợp lệ' }, { message: 'x' }] });
  assert.equal(failure.status, 400);
  assert.equal(failure.message, 'Số trang không hợp lệ');
  assert.equal(failure.log, false);
});

test('HttpError: message của mình đi ra nguyên vẹn, 5xx thì ghi log', () => {
  const notFound = describeFailure(httpError(404, 'Không tìm thấy tập phim'));
  assert.deepEqual(notFound, { status: 404, message: 'Không tìm thấy tập phim', log: false });

  const upstream = describeFailure(new HttpError(502, 'Nguồn trả HTTP 403'));
  assert.deepEqual(upstream, { status: 502, message: 'Nguồn trả HTTP 403', log: true });
});

test('express.json(): lỗi cú pháp body có expose=true nên nói thẳng', () => {
  const parseFailed = Object.assign(new SyntaxError('Unexpected token } in JSON at position 12'), {
    status: 400, expose: true, type: 'entity.parse.failed'
  });
  const failure = describeFailure(parseFailed);
  assert.equal(failure.status, 400);
  assert.match(failure.message, /Unexpected token/);
});

test('lỗi kết nối database: 503 và không lộ host, cổng hay câu lệnh', () => {
  const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
    code: 'ECONNREFUSED', address: '127.0.0.1', port: 5432, syscall: 'connect'
  });
  const failure = describeFailure(refused, { dbReady: true });
  assert.equal(failure.status, 503);
  assert.equal(failure.log, true);
  assert.doesNotMatch(failure.message, /127\.0\.0\.1|5432|ECONNREFUSED/);

  const dns = Object.assign(new Error('getaddrinfo ENOTFOUND db.abcxyz.supabase.co'), { code: 'ENOTFOUND' });
  assert.doesNotMatch(describeFailure(dns).message, /abcxyz|supabase/);
});

test('cùng ECONNREFUSED: qua fetch là lỗi nguồn (502), trần trụi là lỗi database (503)', () => {
  const cause = { code: 'ECONNREFUSED', address: '203.0.113.9', port: 443 };
  assert.equal(describeFailure(fetchFailed(cause)).status, 502);
  assert.equal(describeFailure(Object.assign(new Error('connect ECONNREFUSED 203.0.113.9:443'), cause)).status, 503);
});

test('PostgresError: không lộ tên bảng, cột hay SQLSTATE', () => {
  const sqlError = Object.assign(new Error('relation "movies" does not exist'), {
    name: 'PostgresError', code: '42P01', severity: 'ERROR', table: 'movies', routine: 'parserOpenTable'
  });
  const failure = describeFailure(sqlError, { dbReady: true });
  assert.equal(failure.status, 500);
  assert.equal(failure.log, true);
  assert.doesNotMatch(failure.message, /movies|42P01|relation/);
});

test('lỗi khi gọi ra ngoài: 502 và không lộ tên miền của nguồn', () => {
  const failure = describeFailure(fetchFailed({ code: 'ENOTFOUND', hostname: 'vsmov.com' }));
  assert.equal(failure.status, 502);
  assert.doesNotMatch(failure.message, /vsmov|ENOTFOUND/);

  const aborted = describeFailure(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
  assert.equal(aborted.status, 502);
});

test('lỗi nguồn được xét trước database: provider chết lúc DB đang ngủ vẫn báo 502', () => {
  const failure = describeFailure(fetchFailed({ code: 'ETIMEDOUT' }), { dbReady: false });
  assert.equal(failure.status, 502);
});

test('DB chưa sẵn sàng: 503 để client biết là chờ được', () => {
  const failure = describeFailure(new TypeError('Cannot read properties of undefined'), { dbReady: false });
  assert.equal(failure.status, 503);
  assert.equal(failure.log, true);
});

test('lỗi lập trình: 500 với câu chung, không lộ nội dung lỗi', () => {
  const failure = describeFailure(new TypeError("Cannot read properties of undefined (reading 'slug')"));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(failure.message, /slug|undefined/);
});

test('không có gì để đọc: vẫn trả 500 chứ không nổ', () => {
  for (const value of [undefined, null, 'boom', 42, {}]) {
    const failure = describeFailure(value);
    assert.equal(failure.status, 500);
    assert.ok(failure.message.length > 0);
  }
});

test('shortCause: nói được nguyên nhân mà không kèm host hay cổng', () => {
  assert.equal(shortCause(Object.assign(new Error('getaddrinfo ENOTFOUND db.abcxyz.supabase.co'), { code: 'ENOTFOUND' })), 'không phân giải được tên miền');
  assert.equal(shortCause(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })), 'bị từ chối kết nối');
  assert.equal(shortCause(Object.assign(new Error('password authentication failed for user "postgres"'), { name: 'PostgresError', code: '28P01' })), 'sai mật khẩu database');
  assert.equal(shortCause(new Error('DATABASE_URL is required')), 'thiếu hoặc sai DATABASE_URL');
  assert.equal(shortCause(new Error('chuyện gì đó chưa từng gặp')), 'lỗi kết nối');
  for (const value of [undefined, null, {}]) assert.equal(typeof shortCause(value), 'string');
});
