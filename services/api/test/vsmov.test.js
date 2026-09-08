/**
 * Nguồn duy nhất VSMOV: validate shape ở biên, chuẩn hoá list/detail.
 *
 * Không request mạng nào: `globalThis.fetch` bị thay bằng stub.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { clearHttpCache } = await import('../dist/providers/http.js');
const { catalog } = await import('../dist/providers/index.js');

console.warn = () => {};

const movie = (over = {}) => ({
  _id: '1',
  slug: 'phim-a',
  name: 'Phim A',
  origin_name: null,
  content: null,
  type: 'single',
  status: null,
  year: 2020,
  time: null,
  quality: 'FHD',
  lang: null,
  poster_url: 'https://img.test/p.jpg',
  thumb_url: 'https://img.test/t.jpg',
  trailer_url: null,
  tmdb: { vote_average: 7.5, id: 1, type: 'single' },
  imdb: { id: null },
  view: 10,
  category: [{ name: 'Hành Động' }],
  country: [{ name: 'Việt Nam' }],
  actor: ['Ai Đó'],
  director: ['Đạo Diễn'],
  ...over
});

let routes = {};
let seenUrls = [];

globalThis.fetch = async (url) => {
  seenUrls.push(String(url));
  const parsed = new URL(String(url));
  const key = parsed.pathname;
  const body = routes[key];
  if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => (typeof body === 'function' ? body(parsed) : body) };
};

function stub(extra = {}) {
  clearHttpCache();
  routes = { ...extra };
  seenUrls = [];
}

test('catalog.names chỉ có vsmov', () => {
  assert.deepEqual(catalog.names, ['vsmov']);
});

test('home chuẩn hoá list và đóng dấu source', async () => {
  stub({
    '/api/danh-sach/phim-moi-cap-nhat': {
      data: {
        items: [movie()],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, totalItemsPerPage: 24 }
      }
    }
  });
  const result = await catalog.home({ page: 1, limit: 24 });
  assert.equal(result.source, 'vsmov');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].slug, 'phim-a');
  assert.equal(result.items[0].provider, 'vsmov');
});

/**
 * Nhóm `/danh-sach/:slug` của VSMOV bỏ qua `limit` lẫn mọi bộ lọc
 * `year`/`country`/`category` (đã đối chiếu bằng request thật). Gửi chúng lên
 * chỉ tạo cache-key thừa mà kết quả không đổi — provider phải tự bỏ ở máy mình.
 */
test('danh-sach: không gửi limit/bộ lọc mà nguồn bỏ qua', async () => {
  stub({
    '/api/danh-sach/phim-le': {
      data: { items: [movie()], pagination: { totalItems: 1, totalPages: 1, currentPage: 1, totalItemsPerPage: 20 } }
    }
  });
  await catalog.listBySlug('phim-le', { page: 2, limit: 48, year: '2024', country: 'han-quoc', category: 'hanh-dong', type: 'single', status: 'completed' });
  const asked = new URL(seenUrls[0]);
  assert.equal(asked.pathname, '/api/danh-sach/phim-le');
  for (const dead of ['limit', 'year', 'country', 'category']) {
    assert.equal(asked.searchParams.get(dead), null, `không được gửi ?${dead}= lên /danh-sach`);
  }
  for (const alive of ['page', 'type', 'status']) {
    assert.ok(asked.searchParams.get(alive), `phải giữ ?${alive}= trên /danh-sach`);
  }
});

/** `/tim-kiem` đọc đầy đủ limit + year/country/category/type/status. */
test('tim-kiem: giữ nguyên toàn bộ bộ lọc', async () => {
  stub({
    '/api/tim-kiem': {
      data: { items: [movie()], pagination: { totalItems: 1, totalPages: 1, currentPage: 1, totalItemsPerPage: 5 } }
    }
  });
  await catalog.search('mot', { page: 1, limit: 5, year: '2024', country: 'han-quoc' });
  const asked = new URL(seenUrls[0]);
  assert.equal(asked.pathname, '/api/tim-kiem');
  assert.equal(asked.searchParams.get('keyword'), 'mot');
  assert.equal(asked.searchParams.get('limit'), '5');
  assert.equal(asked.searchParams.get('year'), '2024');
  assert.equal(asked.searchParams.get('country'), 'han-quoc');
});

/** `/quoc-gia/:slug` đọc category/type/status nhưng bỏ year/country. */
test('quoc-gia: bỏ year/country, giữ category', async () => {
  stub({
    '/api/quoc-gia/han-quoc': {
      data: { items: [movie()], pagination: { totalItems: 1, totalPages: 1, currentPage: 1, totalItemsPerPage: 24 } }
    }
  });
  await catalog.byCountry('han-quoc', { page: 1, year: '2024', country: 'viet-nam', category: 'hanh-dong' });
  const asked = new URL(seenUrls[0]);
  assert.equal(asked.searchParams.get('year'), null);
  assert.equal(asked.searchParams.get('country'), null);
  assert.equal(asked.searchParams.get('category'), 'hanh-dong');
});

test('detail trả movie + episodes kèm source', async () => {
  stub({
    '/api/phim/phim-a': {
      data: {
        movie: movie({ slug: 'phim-a' }),
        episodes: [
          {
            server_name: 'Server #1',
            server_data: [{ name: '1', link_embed: 'https://embed.test/1', link_m3u8: null }]
          }
        ]
      }
    }
  });
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'vsmov');
  assert.equal(found.movie.slug, 'phim-a');
  assert.equal(found.episodes.length, 1);
  assert.equal(found.episodes[0].server_data[0].link_embed, 'https://embed.test/1');
});

test('detail thiếu movie thì ném lỗi', async () => {
  stub({ '/api/phim/khong-co': { data: {} } });
  await assert.rejects(() => catalog.detail('khong-co'));
});
