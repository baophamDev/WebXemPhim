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

globalThis.fetch = async (url) => {
  const parsed = new URL(String(url));
  const key = parsed.pathname;
  const body = routes[key];
  if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => (typeof body === 'function' ? body(parsed) : body) };
};

function stub(extra = {}) {
  clearHttpCache();
  routes = { ...extra };
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
