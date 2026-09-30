/**
 * Nguồn dự phòng thứ ba NguonC: chỉ được hỏi khi VSMOV lẫn KKPhim đều không có
 * dữ liệu (list) hoặc không có luồng phát (detail). Nguồn chỉ trả embed nên khi
 * bồi tập, resolver giữ metadata của nguồn chính và chỉ thay danh sách tập.
 *
 * Không request mạng nào: `globalThis.fetch` bị thay bằng stub.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { clearHttpCache } = await import('../dist/providers/http.js');
const { catalog } = await import('../dist/providers/index.js');

console.warn = () => {};

const movie = (over = {}) => ({
  _id: '1', slug: 'phim-a', name: 'Phim A', origin_name: 'Movie A', content: null,
  type: 'single', status: null, year: 2020, time: null, quality: 'FHD', lang: null,
  poster_url: 'https://img.test/p.jpg', thumb_url: 'https://img.test/t.jpg', trailer_url: null,
  tmdb: { vote_average: 7.5, id: 1, type: 'single' }, imdb: { id: null }, view: 10,
  category: [{ name: 'Hành Động' }], country: [{ name: 'Việt Nam' }],
  actor: ['Ai Đó'], director: ['Đạo Diễn'], ...over
});

/** Phim ở dạng list của NguonC — `category` chỉ có ở bản detail. */
const nguonMovie = (over = {}) => ({
  name: 'Trường Sinh Khế (Phần 1)', slug: 'truong-sinh-khe-phan-1',
  original_name: 'Live Forever (Season 1)',
  thumb_url: 'https://img.nguonc.test/t.jpg', poster_url: 'https://img.nguonc.test/p.jpg',
  description: 'Mô tả phim', total_episodes: 20, current_episode: 'Tập 12', time: '20 phút/tập',
  quality: 'HD', language: 'Vietsub', director: 'Gong Yu Shi',
  casts: 'Phương Dật Luân, Tạ Khả Dần', year: '2026', ...over
});

/** Bản detail: metadata gom trong object `category` theo nhóm, tập chỉ có `embed`. */
const nguonDetail = (over = {}) => ({
  id: 7, slug: 'truong-sinh-khe-phan-1', name: 'Trường Sinh Khế', original_name: 'Live Forever',
  description: 'Mô tả', total_episodes: 20, current_episode: 'Tập 12', time: '20 phút/tập',
  quality: 'HD', language: 'Vietsub', director: 'Gong Yu Shi', casts: 'Phương Dật Luân, Tạ Khả Dần',
  category: {
    1: { group: { id: 'g1', name: 'Định dạng' }, list: [{ id: 'x', name: 'Phim bộ' }] },
    2: { group: { id: 'g2', name: 'Thể loại' }, list: [{ id: 'y', name: 'Cổ Trang' }, { id: 'z', name: 'Tình Cảm' }] },
    3: { group: { id: 'g3', name: 'Năm' }, list: [{ id: 'w', name: '2026' }] },
    4: { group: { id: 'g4', name: 'Quốc gia' }, list: [{ id: 'v', name: 'Trung Quốc' }] }
  },
  episodes: [{
    server_name: 'Vietsub #1',
    items: [
      { name: '1', slug: 'tap-1', embed: 'https://embed.streamc.test/embed.php?hash=abc' },
      { name: '2', slug: 'tap-2', embed: 'https://embed.streamc.test/embed.php?hash=def' }
    ]
  }],
  ...over
});

const paginate = (over = {}) => ({ current_page: 1, total_page: 3338, total_items: 33373, items_per_page: 10, ...over });
const deny = { __status: 403 };

let routes = {};
let seenUrls = [];

globalThis.fetch = async (url) => {
  seenUrls.push(String(url));
  const parsed = new URL(String(url));
  const body = routes[parsed.host + parsed.pathname];
  if (body === undefined) return { ok: false, status: 404, json: async () => ({ status: 'error', message: 'not found' }) };
  if (body && body.__status) return { ok: false, status: body.__status, json: async () => ({ status: 'error', message: 'denied' }) };
  return { ok: true, status: 200, json: async () => (typeof body === 'function' ? body(parsed) : body) };
};

function stub(extra = {}) {
  clearHttpCache();
  routes = { ...extra };
  seenUrls = [];
}

test('home: VSMOV và KKPhim đều chết thì NguonC thay thế', async () => {
  stub({
    'vsmov.com/api/danh-sach/phim-moi-cap-nhat': deny,
    'phimapi.com/danh-sach/phim-moi-cap-nhat': deny,
    'phim.nguonc.com/api/films/phim-moi-cap-nhat': { status: 'success', paginate: paginate({ current_page: 2, items_per_page: 10 }), items: [nguonMovie()] }
  });
  const result = await catalog.home({ page: 2 });
  assert.equal(result.source, 'nguonc');
  assert.equal(result.items[0].provider, 'nguonc');
  assert.equal(result.items[0].year, 2026);
  assert.equal(result.items[0].type, 'series');
  assert.equal(result.items[0].status, 'ongoing');
  assert.deepEqual(result.items[0].actors, ['Phương Dật Luân', 'Tạ Khả Dần']);
  assert.equal(result.pagination.totalItems, 33373);
  assert.equal(result.pagination.currentPage, 2);
  assert.equal(result.pagination.totalItemsPerPage, 10);
});

test('list: slug phim-moi-cap-nhat đi đường riêng, slug khác đi /danh-sach', async () => {
  stub({
    'vsmov.com/api/danh-sach/phim-moi-cap-nhat': deny,
    'phimapi.com/danh-sach/phim-moi-cap-nhat': deny,
    'phim.nguonc.com/api/films/phim-moi-cap-nhat': { status: 'success', paginate: paginate(), items: [nguonMovie()] }
  });
  await catalog.listBySlug('phim-moi-cap-nhat', { page: 1 });
  assert.equal(new URL(seenUrls.at(-1)).pathname, '/api/films/phim-moi-cap-nhat');

  stub({
    'vsmov.com/api/danh-sach/phim-bo': deny,
    'phimapi.com/danh-sach/phim-bo': deny,
    'phim.nguonc.com/api/films/danh-sach/phim-bo': { status: 'success', cat: { name: 'Phim bộ', slug: 'phim-bo' }, paginate: paginate(), items: [nguonMovie()] }
  });
  await catalog.listBySlug('phim-bo', { page: 3 });
  const asked = new URL(seenUrls.at(-1));
  assert.equal(asked.pathname, '/api/films/danh-sach/phim-bo');
  assert.equal(asked.searchParams.get('page'), '3');
  assert.equal(asked.searchParams.get('limit'), null, 'nguồn không đọc limit');
});

test('byGenre/byYear: đúng đường của nguồn, chỉ gửi page', async () => {
  stub({
    'vsmov.com/api/the-loai/hanh-dong': deny,
    'phimapi.com/v1/api/the-loai/hanh-dong': deny,
    'phim.nguonc.com/api/films/the-loai/hanh-dong': { status: 'success', paginate: paginate({ current_page: 4 }), items: [nguonMovie()] }
  });
  const byGenre = await catalog.byGenre('hanh-dong', { page: 4, limit: 24, year: '2024', type: 'series' });
  assert.equal(byGenre.source, 'nguonc');
  const genreAsked = new URL(seenUrls.at(-1));
  assert.equal(genreAsked.pathname, '/api/films/the-loai/hanh-dong');
  assert.equal(genreAsked.searchParams.get('page'), '4');
  assert.equal(genreAsked.searchParams.get('year'), null);
  assert.equal(genreAsked.searchParams.get('type'), null);

  stub({
    'vsmov.com/api/nam/2024': deny,
    'phimapi.com/v1/api/nam/2024': deny,
    'phim.nguonc.com/api/films/nam-phat-hanh/2024': { status: 'success', paginate: paginate(), items: [nguonMovie()] }
  });
  await catalog.byYear('2024', { page: 1 });
  assert.equal(new URL(seenUrls.at(-1)).pathname, '/api/films/nam-phat-hanh/2024');
});

test('search: gửi keyword + page', async () => {
  stub({
    'vsmov.com/api/tim-kiem': deny,
    'phimapi.com/tim-kiem': deny,
    'phim.nguonc.com/api/films/search': { status: 'success', paginate: paginate({ total_items: 33, total_page: 4 }), items: [nguonMovie()] }
  });
  const result = await catalog.search('trường sinh', { page: 2, limit: 10 });
  assert.equal(result.source, 'nguonc');
  assert.equal(result.pagination.totalItems, 33);
  const asked = new URL(seenUrls.at(-1));
  assert.equal(asked.pathname, '/api/films/search');
  assert.equal(asked.searchParams.get('keyword'), 'trường sinh');
  assert.equal(asked.searchParams.get('page'), '2');
});
const vsmovDecoy = (over = {}) => ({
  data: {
    movie: movie({ slug: 'truong-sinh-khe-phan-1', name: 'Trường Sinh Khế', year: 2026, ...over }),
    episodes: [{ server_name: 'Server #1', server_data: [{ name: '1', link_embed: 'https://vsmov.test/1', link_m3u8: null }] }]
  }
});

test('detail: hai nguồn kia không có luồng phát thì bồi tập embed của NguonC', async () => {
  stub({
    'vsmov.com/api/phim/truong-sinh-khe-phan-1': vsmovDecoy(),
    'phimapi.com/phim/truong-sinh-khe-phan-1': { __status: 404 },
    'phimapi.com/tim-kiem': { status: true, data: { items: [] } },
    'phim.nguonc.com/api/film/truong-sinh-khe-phan-1': { status: 'success', movie: nguonDetail() }
  });
  const found = await catalog.detail('truong-sinh-khe-phan-1');
  assert.equal(found.source, 'nguonc');
  // Metadata giữ của nguồn chính, tập thay bằng embed thật của NguonC.
  assert.equal(found.movie.slug, 'truong-sinh-khe-phan-1');
  assert.equal(found.movie.name, 'Trường Sinh Khế');
  assert.equal(found.movie.year, 2026);
  assert.equal(found.episodes[0].server_name, 'Vietsub #1');
  assert.equal(found.episodes[0].server_data.length, 2);
  assert.equal(found.episodes[0].server_data[0].link_embed, 'https://embed.streamc.test/embed.php?hash=abc');
  assert.equal(found.episodes[0].server_data[0].link_m3u8, null);
  assert.ok(seenUrls.some((url) => url.includes('nguonc.com')));
});

test('detail: VSMOV chết hẳn thì NguonC là nguồn duy nhất, map category thành metadata', async () => {
  stub({
    'vsmov.com/api/phim/phim-x': deny,
    'phimapi.com/phim/phim-x': deny,
    'phim.nguonc.com/api/film/phim-x': { status: 'success', movie: nguonDetail({ slug: 'phim-x' }) }
  });
  const found = await catalog.detail('phim-x');
  assert.equal(found.source, 'nguonc');
  assert.equal(found.movie.slug, 'phim-x');
  assert.equal(found.movie.type, 'series');
  assert.equal(found.movie.year, 2026);
  assert.deepEqual(found.movie.genres, ['Cổ Trang', 'Tình Cảm']);
  assert.deepEqual(found.movie.countries, ['Trung Quốc']);
  assert.equal(found.episodes[0].server_data.length, 2);
});

test('detail: NguonC không có phim thì giữ bản VSMOV', async () => {
  stub({
    'vsmov.com/api/phim/phim-y': vsmovDecoy({ slug: 'phim-y' }),
    'phimapi.com/phim/phim-y': { __status: 404 },
    'phimapi.com/tim-kiem': { status: true, data: { items: [] } },
    'phim.nguonc.com/api/film/phim-y': { __status: 404 },
    'phim.nguonc.com/api/films/search': { status: 'success', paginate: paginate(), items: [] }
  });
  const found = await catalog.detail('phim-y');
  assert.equal(found.source, 'vsmov');
  assert.equal(found.movie.slug, 'phim-y');
  assert.equal(found.episodes[0].server_data[0].link_embed, 'https://vsmov.test/1');
});

test('detail: slug khác hệ thì NguonC tìm theo tên rồi bù year từ bản search', async () => {
  stub({
    'vsmov.com/api/phim/phim-z': vsmovDecoy({ slug: 'phim-z', name: 'Trường Sinh Khế', origin_name: 'Live Forever', year: 2026 }),
    'phimapi.com/phim/phim-z': { __status: 404 },
    'phimapi.com/tim-kiem': { status: true, data: { items: [] } },
    'phim.nguonc.com/api/film/phim-z': { __status: 404 },
    'phim.nguonc.com/api/films/search': {
      status: 'success',
      paginate: paginate({ total_items: 1, total_page: 1 }),
      items: [nguonMovie({ slug: 'truong-sinh-khe', name: 'Trường Sinh Khế', original_name: 'Live Forever', year: '2026' })]
    },
    'phim.nguonc.com/api/film/truong-sinh-khe': { status: 'success', movie: nguonDetail({ slug: 'truong-sinh-khe' }) }
  });
  const found = await catalog.detail('phim-z');
  assert.equal(found.source, 'nguonc');
  assert.equal(found.movie.slug, 'phim-z');
  assert.equal(found.movie.name, 'Trường Sinh Khế');
  assert.equal(found.episodes[0].server_data.length, 2);
  assert.ok(seenUrls.some((url) => url.includes('/api/films/search')));
});