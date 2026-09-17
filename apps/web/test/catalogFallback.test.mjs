/**
 * Bảng route dự phòng: API không trả lời thì web hỏi vsmov ở đâu.
 *
 * Vì sao phải có test: đây là bảng dịch giữa hai hệ URL, và **lệch một chữ là im
 * lặng**: `catalogTarget()` trả `null` thì `api.ts` rơi về đúng hành vi cũ (một
 * trang "Mất kết nối"), không có lỗi nào hiện ra ở đâu cả. Cùng lý do với
 * `boot.test.mjs` — loại hỏng này chạy thử bằng mắt không thấy.
 *
 * `src/catalogFallback.ts` cố ý không import gì nên biên dịch được một file duy
 * nhất, không cần bundler (xem chú thích trong file đó).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const fallback = (() => {
  const ts = createRequire(import.meta.url)('typescript');
  const js = ts.transpileModule(readFileSync(resolve(app, 'src/catalogFallback.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const box = { exports: {} };
  new Function('exports', 'module', js)(box.exports, box);
  return box.exports;
})();

const { catalogTarget, apiUnavailable } = fallback;

/** Đường dẫn kèm tham số, đúng như `fetchBaseQuery` dựng từ `{url, params}`. */
const url = (target) => (target.kind === 'list' ? target.url : null);

test('trang chủ: bỏ limit, giữ page/type/status', () => {
  // Nhóm /danh-sach/:slug của nguồn tự ép limit riêng, gửi limit chỉ tạo URL khác
  // đi mà kết quả không đổi — và URL khác thì cache của nguồn coi là câu hỏi mới.
  assert.deepEqual(catalogTarget('/catalog/home'), { kind: 'list', url: '/danh-sach/phim-moi-cap-nhat', limit: 24 });
  assert.equal(url(catalogTarget({ url: '/catalog/home', params: { page: 2, limit: 48, year: '2024', type: 'series', status: 'ongoing' } })),
    '/danh-sach/phim-moi-cap-nhat?page=2&type=series&status=ongoing');
});

test('danh sách: slug đi thẳng vào /danh-sach/:slug', () => {
  assert.equal(url(catalogTarget({ url: '/catalog/lists/phim-bo', params: { page: 1 } })), '/danh-sach/phim-bo?page=1');
  // `/danh-sach/:slug` cũng là đường của "code" (lịch phát hành theo mã).
  assert.equal(url(catalogTarget('/catalog/codes/dune-2026')), '/danh-sach/dune-2026');
});

test('thể loại: danh mục đầy đủ vs danh sách theo thể loại', () => {
  assert.deepEqual(catalogTarget('/catalog/genres'), { kind: 'taxonomy', url: '/the-loai' });
  // /the-loai/:slug đọc hết bộ lọc, kể cả year và country.
  assert.equal(url(catalogTarget({
    url: '/catalog/genres/hanh-dong',
    params: { page: 3, limit: 24, year: '2025', country: 'viet-nam', category: 'hanh-dong', type: 'series', status: 'completed' }
  })), '/the-loai/hanh-dong?page=3&limit=24&year=2025&country=viet-nam&category=hanh-dong&type=series&status=completed');
});

test('quốc gia: nguồn bỏ year và country, gửi thừa là URL khác đi vô ích', () => {
  assert.deepEqual(catalogTarget('/catalog/countries'), { kind: 'taxonomy', url: '/quoc-gia' });
  assert.equal(url(catalogTarget({
    url: '/catalog/countries/viet-nam',
    params: { page: 2, limit: 24, year: '2025', country: 'viet-nam', category: 'hanh-dong', type: 'single' }
  })), '/quoc-gia/viet-nam?page=2&limit=24&category=hanh-dong&type=single');
});

test('năm: nguồn bỏ country/category, năm nằm trong đường dẫn', () => {
  assert.deepEqual(catalogTarget('/catalog/years'), { kind: 'taxonomy', url: '/nam' });
  assert.equal(url(catalogTarget({
    url: '/catalog/years/2025',
    params: { page: 1, limit: 24, country: 'viet-nam', category: 'hanh-dong', type: 'series' }
  })), '/nam/2025?page=1&limit=24&type=series');
});

test('diễn viên và tìm kiếm', () => {
  assert.deepEqual(catalogTarget('/catalog/actors'), { kind: 'taxonomy', url: '/dien-vien' });
  assert.equal(url(catalogTarget({ url: '/catalog/search', params: { q: 'avengers', page: 1, limit: 24 } })),
    '/tim-kiem?keyword=avengers&page=1&limit=24');
  // Thiếu từ khoá thì nguồn trả cả kho phim — thà không hỏi.
  assert.equal(catalogTarget({ url: '/catalog/search', params: {} }), null);
});

test('menu và trang chi tiết', () => {
  assert.deepEqual(catalogTarget('/catalog/navigation'), { kind: 'navigation' });
  assert.deepEqual(catalogTarget('/catalog/movies/tay-du-ky-2025'), { kind: 'detail', slug: 'tay-du-ky-2025' });
});

test('slug được mã hoá lại y như api.ts dựng URL', () => {
  assert.deepEqual(catalogTarget('/catalog/movies/ng%C6%B0%E1%BB%9Di-%C4%91%E1%BA%B9p'), { kind: 'detail', slug: 'ng%C6%B0%E1%BB%9Di-%C4%91%E1%BA%B9p' });
});

test('tham số rỗng và undefined không vào URL', () => {
  assert.equal(url(catalogTarget({ url: '/catalog/lists/phim-le', params: { page: 1, type: undefined, status: '', category: null } })),
    '/danh-sach/phim-le?page=1');
});

test('limit mặc định là 24, số rác thì bỏ qua', () => {
  assert.equal(catalogTarget('/catalog/lists/phim-le').limit, 24);
  assert.equal(catalogTarget({ url: '/catalog/lists/phim-le', params: { limit: 'khong-phai-so' } }).limit, 24);
  assert.equal(catalogTarget({ url: '/catalog/lists/phim-le', params: { limit: 0 } }).limit, 24);
  assert.equal(catalogTarget({ url: '/catalog/genres/hanh-dong', params: { limit: 48 } }).limit, 48);
});

test('route không thuộc catalog thì không dự phòng', () => {
  // Kho, người, phụ đề, tiến trình... đều cần API thật: không có nguồn nào khác
  // để đọc, nên thà hiện đúng lỗi cũ còn hơn trả dữ liệu sai hình dạng.
  for (const path of ['/health', '/movies', '/movies/tay-du-ky', '/search?q=a', '/people', '/favorites', '/continue-watching', '/episodes/12', '/sync/status', '/catalog']) {
    assert.equal(catalogTarget(path), null, path);
  }
});

test('chỉ GET mới dự phòng', () => {
  assert.equal(catalogTarget({ url: '/catalog/home', method: 'POST' }), null);
  assert.deepEqual(catalogTarget({ url: '/catalog/home', method: 'GET' }), { kind: 'list', url: '/danh-sach/phim-moi-cap-nhat', limit: 24 });
});

test('apiUnavailable: chỉ những lỗi nghĩa là "không hỏi được API"', () => {
  for (const status of ['FETCH_ERROR', 'TIMEOUT_ERROR', 'PARSING_ERROR', 404, 500, 502, 503]) {
    assert.equal(apiUnavailable(status), true, String(status));
  }
  // 400/403 là API trả lời rõ ràng; 401/422 cũng vậy. Đọc thẳng nguồn lúc đó là
  // che mất lỗi thật của mình.
  for (const status of [200, 201, 400, 401, 403, 422, 'CUSTOM_ERROR']) {
    assert.equal(apiUnavailable(status), false, String(status));
  }
});
