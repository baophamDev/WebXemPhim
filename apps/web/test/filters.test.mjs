/**
 * Bảng dịch của bộ lọc Khám Phá: khoá trên URL ↔ tiêu chí ghim ở đường dẫn.
 *
 * Vì sao phải có test: đây toàn là ánh xạ "lệch một chữ là im lặng" — ghi sai
 * khoá thì nguồn bỏ qua bộ lọc; `commitFilters` trả nhầm nhánh thì nút "Áp dụng"
 * đổi URL mà trang không đổi theo. Không có lỗi nào hiện ra ở đâu cả.
 *
 * `src/filters.ts` cố ý không import gì chạy được nên biên dịch được một file duy
 * nhất, không cần bundler (xem chú thích trong file đó).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const filters = (() => {
  const ts = createRequire(import.meta.url)('typescript');
  const js = ts.transpileModule(readFileSync(resolve(app, 'src/filters.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const box = { exports: {} };
  new Function('exports', 'module', js)(box.exports, box);
  return box.exports;
})();

const {
  BROWSE_HOME, activeFilters, browseHref, commitFilters, emptyFilters,
  filtersChanged, filtersEmpty, readFilters, withFilters
} = filters;

const params = (search = '') => new URLSearchParams(search);
const draftOf = (values) => ({ ...emptyFilters(), ...values });

test('menu Khám phá: thể loại/quốc gia/năm đi vào đường dẫn, định dạng/trạng thái vào query', () => {
  assert.equal(browseHref('genre', { slug: 'hanh-dong' }), '/browse/genre/hanh-dong');
  assert.equal(browseHref('country', { slug: 'viet-nam' }), '/browse/country/viet-nam');
  assert.equal(browseHref('year', { slug: '2024' }), '/browse/year/2024');
  assert.equal(browseHref('format', { slug: 'series' }), `${BROWSE_HOME}?type=series`);
  assert.equal(browseHref('status', { slug: 'ongoing' }), `${BROWSE_HOME}?status=ongoing`);
  // Slug có dấu phải được mã hoá: link dán vào trình duyệt vẫn mở đúng trang.
  assert.equal(browseHref('genre', { slug: 'tình cảm' }), '/browse/genre/t%C3%ACnh%20c%E1%BA%A3m');
});

test('đọc bộ lọc từ URL: thiếu khoá nào trả rỗng khoá đó', () => {
  assert.deepEqual(readFilters(params('type=series&year=2024')), draftOf({ type: 'series', year: '2024' }));
  assert.deepEqual(readFilters(params()), emptyFilters());
});

test('trang thể loại/quốc gia/năm: tiêu chí nằm ở đường dẫn cũng phải hiện trong bộ lọc', () => {
  assert.equal(activeFilters('genre', 'hanh-dong', params()).category, 'hanh-dong');
  assert.equal(activeFilters('country', 'viet-nam', params()).country, 'viet-nam');
  assert.equal(activeFilters('year', '2024', params()).year, '2024');
  // Query thắng đường dẫn: URL cũ còn sót khoá thì không đè lên lựa chọn mới.
  assert.equal(activeFilters('genre', 'hanh-dong', params('category=tinh-cam')).category, 'tinh-cam');
  // Trang danh sách không ghim tiêu chí nào.
  assert.deepEqual(activeFilters('list', 'phim-moi-cap-nhat', params()), emptyFilters());
  // Đường dẫn mã hoá phải được giải mã trước khi so với slug trong danh mục.
  assert.equal(activeFilters('genre', 't%C3%ACnh-c%E1%BA%A3m', params()).category, 'tình-cảm');
});

test('ghi bộ lọc: cả bộ vào query, khoá rỗng bị xoá, trang về 1', () => {
  const next = withFilters(params('page=3&type=series&q=giữ'), draftOf({ category: 'hanh-dong', status: 'ongoing' }));
  assert.equal(next.get('category'), 'hanh-dong');
  assert.equal(next.get('status'), 'ongoing');
  assert.equal(next.get('type'), null);
  assert.equal(next.get('page'), null);
  assert.equal(next.get('q'), 'giữ');
});

test('ghi bộ lọc: tiêu chí đã ghim ở đường dẫn không được ghi lặp vào query', () => {
  const next = withFilters(params('category=hanh-dong&country=viet-nam'), draftOf({ country: 'viet-nam' }), ['category']);
  assert.equal(next.get('category'), null);
  assert.equal(next.get('country'), 'viet-nam');
});

test('trang danh sách: "Áp dụng" chỉ đổi query', () => {
  const target = commitFilters('list', 'phim-moi-cap-nhat', params('page=2'), draftOf({ type: 'series', country: 'viet-nam' }));
  assert.equal(target.kind, 'search');
  assert.equal(target.params.get('type'), 'series');
  assert.equal(target.params.get('country'), 'viet-nam');
  assert.equal(target.params.get('page'), null);
});

test('trang thể loại: giữ nguyên thể loại thì thể loại vẫn ở đường dẫn, không lặp vào query', () => {
  const target = commitFilters('genre', 'hanh-dong', params('page=2&country=viet-nam'), draftOf({ category: 'hanh-dong', country: 'viet-nam' }));
  assert.equal(target.kind, 'search');
  assert.equal(target.params.get('category'), null);
  assert.equal(target.params.get('country'), 'viet-nam');
  assert.equal(target.params.get('page'), null);
});

test('trang thể loại: đổi thể loại thì đổi hẳn route, các bộ lọc khác đi theo', () => {
  const target = commitFilters('genre', 'hanh-dong', params('country=viet-nam&page=2'), draftOf({ category: 'tinh-cam', country: 'viet-nam' }));
  assert.equal(target.kind, 'path');
  assert.equal(target.path, '/browse/genre/tinh-cam?country=viet-nam');
});

test('trang thể loại: bỏ trắng thể loại thì về danh sách trung tính', () => {
  const target = commitFilters('genre', 'hanh-dong', params('type=series'), draftOf({ type: 'series' }));
  assert.equal(target.kind, 'path');
  assert.equal(target.path, `${BROWSE_HOME}?type=series`);
});

test('trang năm: đổi năm đi qua route năm, không gửi năm lặp lại', () => {
  const target = commitFilters('year', '2024', params(), draftOf({ year: '2023', type: 'single' }));
  assert.equal(target.kind, 'path');
  assert.equal(target.path, '/browse/year/2023?type=single');
});

test('bản nháp: so sánh và rỗng', () => {
  assert.equal(filtersChanged(draftOf({ type: 'series' }), emptyFilters()), true);
  assert.equal(filtersChanged(draftOf({ type: 'series' }), draftOf({ type: 'series' })), false);
  assert.equal(filtersEmpty(emptyFilters()), true);
  assert.equal(filtersEmpty(draftOf({ year: '2024' })), false);
});
