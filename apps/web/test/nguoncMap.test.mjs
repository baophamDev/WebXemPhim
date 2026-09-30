/**
 * Bảng dịch VSMOV → NguonC và cách đọc payload NguonC.
 *
 * Vì sao phải có test: đây là bảng dịch giữa hai hệ URL và hai shape dữ liệu —
 * lệch một chữ là im lặng, trang danh sách trắng hoặc tập phim rỗng, không có
 * lỗi nào hiện ra ở đâu cả. `src/nguoncMap.ts` cố ý không import gì chạy được
 * nên biên dịch được một file duy nhất (xem chú thích trong file đó).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const map = (() => {
  const ts = createRequire(import.meta.url)('typescript');
  const js = ts.transpileModule(readFileSync(resolve(app, 'src/nguoncMap.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const box = { exports: {} };
  new Function('exports', 'module', js)(box.exports, box);
  return box.exports;
})();

const { nguoncPath, nguoncDetailPath, nguoncTaxonomy, listFromNguonc, episodesFromPayload, episodesFromNguonc, movieFromNguonc, NGUONC_GENRES } = map;

test('menu: NguonC có đủ thể loại của phim.nguonc.com, không trùng slug', () => {
  assert.ok(NGUONC_GENRES.length >= 20, `phải đủ menu, nhận ${NGUONC_GENRES.length}`);
  const slugs = NGUONC_GENRES.map((item) => item.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slug không được trùng');
  for (const slug of ['hanh-dong', 'tam-ly', 'tinh-cam', 'mien-tay', 'co-trang', 'kinh-di']) {
    assert.ok(slugs.includes(slug), `thiếu thể loại ${slug}`);
  }
});

test('danh mục: chỉ thể loại mới có menu, quốc gia/năm phải rơi tiếp', () => {
  assert.equal(nguoncTaxonomy('/the-loai').source, 'nguonc');
  assert.ok(nguoncTaxonomy('/the-loai').items.length);
  assert.equal(nguoncTaxonomy('/quoc-gia'), null);
  assert.equal(nguoncTaxonomy('/nam'), null);
});

test('URL: dịch đúng từng nhóm đường của VSMOV', () => {
  assert.equal(nguoncPath('/danh-sach/phim-moi-cap-nhat'), '/films/phim-moi-cap-nhat');
  assert.equal(nguoncPath('/danh-sach/phim-bo?page=3'), '/films/danh-sach/phim-bo?page=3');
  assert.equal(nguoncPath('/the-loai/hanh-dong'), '/films/the-loai/hanh-dong');
  assert.equal(nguoncPath('/quoc-gia/viet-nam'), '/films/quoc-gia/viet-nam');
  assert.equal(nguoncPath('/nam/2024'), '/films/nam-phat-hanh/2024');
  assert.equal(nguoncPath('/tim-kiem?keyword=django&page=1'), '/films/search?keyword=django&page=1');
  // Không có đường tương ứng thì trả null để chỗ gọi rơi xuống nguồn khác.
  assert.equal(nguoncPath('/dien-vien'), null);
  assert.equal(nguoncPath('/code'), null);
  assert.equal(nguoncDetailPath('hành trình django'), '/film/h%C3%A0nh%20tr%C3%ACnh%20django');
});

test('danh sách: đọc paginate snake_case và chuẩn hoá thẻ phim', () => {
  const page = listFromNguonc({
    status: 'success',
    paginate: { current_page: 2, total_page: 3338, total_items: 33373, items_per_page: 10 },
    items: [{
      name: 'Trường Sinh Khế (Phần 1)', slug: 'truong-sinh-khe-phan-1', original_name: 'Live Forever (Season 1)',
      thumb_url: 'https://img.nguonc.test/t.jpg', total_episodes: 20, current_episode: 'Tập 12',
      time: '20 phút/tập', quality: 'HD', language: 'Vietsub', casts: 'Phương Dật Luân, Tạ Khả Dần', year: '2026'
    }]
  }, 24);
  assert.equal(page.source, 'nguonc');
  assert.equal(page.pagination.currentPage, 2);
  assert.equal(page.pagination.totalItems, 33373);
  assert.equal(page.pagination.totalItemsPerPage, 10);
  const movie = page.items[0];
  assert.equal(movie.provider, 'nguonc');
  assert.equal(movie.year, 2026);
  assert.equal(movie.type, 'series');
  assert.equal(movie.status, 'ongoing');
  assert.equal(movie.duration, '20 phút/tập');
  assert.deepEqual(movie.actors, ['Phương Dật Luân', 'Tạ Khả Dần']);
});

test('chi tiết: category theo nhóm thành metadata, tập chỉ có embed', () => {
  const detail = episodesFromPayload({
    status: 'success',
    movie: {
      slug: 'truong-sinh-khe', name: 'Trường Sinh Khế', original_name: 'Live Forever',
      total_episodes: 20, current_episode: 'Hoàn tất (20/20)', casts: 'A, B',
      category: {
        1: { group: { name: 'Định dạng' }, list: [{ name: 'Phim bộ' }] },
        2: { group: { name: 'Thể loại' }, list: [{ name: 'Cổ Trang' }, { name: 'Tình Cảm' }] },
        3: { group: { name: 'Năm' }, list: [{ name: '2026' }] },
        4: { group: { name: 'Quốc gia' }, list: [{ name: 'Trung Quốc' }] }
      },
      episodes: [
        { server_name: 'Vietsub #1', items: [
          { name: '1', slug: 'tap-1', embed: 'https://embed.streamc.test/embed.php?hash=abc' },
          { name: '2', slug: 'tap-2', embed: 'https://embed.streamc.test/embed.php?hash=def' }
        ] },
        { server_name: 'Rỗng', items: [{ name: '3', slug: 'tap-3', embed: '' }] }
      ]
    }
  }, 'truong-sinh-khe');
  assert.equal(detail.movie.type, 'series');
  assert.equal(detail.movie.status, 'completed');
  assert.equal(detail.movie.year, 2026);
  assert.deepEqual(detail.movie.genres, ['Cổ Trang', 'Tình Cảm']);
  assert.deepEqual(detail.movie.countries, ['Trung Quốc']);
  // Nhóm không còn tập nào dùng được thì bỏ luôn.
  assert.equal(detail.episodes.length, 1);
  const episodes = episodesFromNguonc(detail.episodes);
  assert.equal(episodes.length, 2);
  assert.equal(episodes[0].embedUrl, 'https://embed.streamc.test/embed.php?hash=abc');
  assert.equal(episodes[0].m3u8Url, null);
  assert.ok(episodes[0].id < 0, 'id âm để không đụng id thật của kho');
  assert.equal(episodes[1].episodeNumber, 2);
});

test('movieFromNguonc: thiếu slug thì bỏ; thiếu tên thì lấy tạm slug', () => {
  assert.equal(movieFromNguonc({ name: 'Không có slug' }), null);
  // Bản list của nguồn luôn có tên, nhưng thẻ phim không được rỗng tên vì một
  // field thiếu — slug là thứ tối thiểu còn bấm được.
  assert.equal(movieFromNguonc({ slug: 'khong-co-ten' }).name, 'khong-co-ten');
});