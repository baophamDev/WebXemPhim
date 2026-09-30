/**
 * Chuỗi dự phòng VSMOV → KKPhim: nguồn sau chỉ được hỏi khi nguồn trước lỗi,
 * trả rỗng, hoặc không có luồng phát được; slug người dùng mở luôn được giữ làm
 * khoá bản ghi. Không request mạng nào: `globalThis.fetch` bị thay bằng stub.
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
  origin_name: 'Movie A',
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

const episode = (over = {}) => ({
  server_name: 'Vietsub',
  server_data: [{ name: 'Tập 001', link_embed: 'https://player.test/1', link_m3u8: 'https://cdn.test/1.m3u8', ...over }]
});

/** Danh sách rỗng của VSMOV: nguồn trả lời nhưng không có gì → phải thử KKPhim. */
const emptyList = { data: { items: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1, totalItemsPerPage: 24 } } };

let routes = {};
let seenUrls = [];

globalThis.fetch = async (url) => {
  seenUrls.push(String(url));
  const parsed = new URL(String(url));
  const body = routes[parsed.host + parsed.pathname];
  if (body === undefined) return { ok: false, status: 404, json: async () => ({ status: false, msg: 'hmmm!' }) };
  if (body && body.__status) return { ok: false, status: body.__status, json: async () => ({ status: false, msg: 'hmmm!' }) };
  return { ok: true, status: 200, json: async () => (typeof body === 'function' ? body(parsed) : body) };
};

function stub(extra = {}) {
  clearHttpCache();
  routes = { ...extra };
  seenUrls = [];
}

test('home: VSMOV 403 thì KKPhim thay thế', async () => {
  stub({
    'vsmov.com/api/danh-sach/phim-moi-cap-nhat': { __status: 403 },
    'phimapi.com/danh-sach/phim-moi-cap-nhat': {
      status: true,
      items: [movie()],
      pagination: { totalItems: 1, totalPages: 1, currentPage: 1, totalItemsPerPage: 24 }
    }
  });
  const result = await catalog.home({ page: 1, limit: 24 });
  assert.equal(result.source, 'kkphim');
  assert.equal(result.items[0].provider, 'kkphim');
  assert.equal(result.items[0].slug, 'phim-a');
});

test('home: VSMOV trả rỗng thì cũng rơi xuống KKPhim', async () => {
  stub({
    'vsmov.com/api/danh-sach/phim-moi-cap-nhat': emptyList,
    'phimapi.com/danh-sach/phim-moi-cap-nhat': {
      status: true,
      items: [movie()],
      pagination: { totalItems: 1, totalPages: 1, currentPage: 1, totalItemsPerPage: 24 }
    }
  });
  const result = await catalog.home({ page: 2 });
  assert.equal(result.source, 'kkphim');
});

test('byGenre: dùng endpoint v1, bỏ type/status nguồn không đọc', async () => {
  stub({
    'vsmov.com/api/the-loai/hanh-dong': emptyList,
    'phimapi.com/v1/api/the-loai/hanh-dong': {
      status: true,
      data: { items: [movie()], params: { pagination: { totalItems: 7, totalPages: 2, currentPage: 1, totalItemsPerPage: 5 } } }
    }
  });
  const result = await catalog.byGenre('hanh-dong', {
    page: 1, limit: 5, year: '2024', country: 'viet-nam', category: 'hanh-dong', type: 'series', status: 'completed'
  });
  assert.equal(result.source, 'kkphim');
  assert.equal(result.pagination.totalItems, 7);
  const asked = new URL(seenUrls.at(-1));
  assert.equal(asked.pathname, '/v1/api/the-loai/hanh-dong');
  for (const alive of ['page', 'limit', 'year', 'country', 'category']) {
    assert.ok(asked.searchParams.get(alive), `phải giữ ?${alive}=`);
  }
  for (const dead of ['type', 'status']) {
    assert.equal(asked.searchParams.get(dead), null, `không được gửi ?${dead}=`);
  }
});

test('search: /tim-kiem với keyword, không phân trang thì tự dựng', async () => {
  stub({
    'vsmov.com/api/tim-kiem': emptyList,
    'phimapi.com/tim-kiem': { status: true, data: { items: [movie()] } }
  });
  const result = await catalog.search('phim a', { page: 1, limit: 5, year: '2020', country: 'viet-nam', category: 'hanh-dong', type: 'single', status: 'completed' });
  assert.equal(result.source, 'kkphim');
  assert.equal(result.pagination.totalItemsPerPage, 5);
  const asked = new URL(seenUrls.at(-1));
  assert.equal(asked.pathname, '/tim-kiem');
  assert.equal(asked.searchParams.get('keyword'), 'phim a');
  assert.equal(asked.searchParams.get('limit'), '5');
  assert.equal(asked.searchParams.get('year'), '2020');
  assert.equal(asked.searchParams.get('category'), 'hanh-dong');
  assert.equal(asked.searchParams.get('country'), 'viet-nam');
  assert.equal(asked.searchParams.get('type'), null);
  assert.equal(asked.searchParams.get('status'), null);
});

test('taxonomy thiếu ở KKPhim thì cả chuỗi ném lỗi để server rơi xuống DB', async () => {
  stub({ 'vsmov.com/api/nam': { __status: 403 } });
  await assert.rejects(() => catalog.years());
});
test('detail: VSMOV có m3u8 thật thì dùng luôn, không hỏi KKPhim', async () => {
  stub({
    'vsmov.com/api/phim/phim-a': { data: { movie: movie(), episodes: [episode()] } }
  });
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'vsmov');
  assert.equal(found.episodes[0].server_data[0].link_m3u8, 'https://cdn.test/1.m3u8');
  assert.equal(seenUrls.length, 1);
  assert.ok(seenUrls[0].includes('vsmov.com'));
});

test('detail: VSMOV hết luồng phát (m3u8 rỗng) thì lấy bản KKPhim theo slug', async () => {
  stub({
    'vsmov.com/api/phim/phim-a': { data: { movie: movie(), episodes: [episode({ link_m3u8: null })] } },
    'phimapi.com/phim/phim-a': { status: true, movie: movie({ _id: '99' }), episodes: [episode()] }
  });
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'kkphim');
  assert.equal(found.movie.slug, 'phim-a');
  assert.equal(found.episodes[0].server_data[0].link_m3u8, 'https://cdn.test/1.m3u8');
});

test('detail: VSMOV chết hẳn thì slug nguồn không ghi đè slug người dùng mở', async () => {
  stub({
    'vsmov.com/api/phim/ten-phim': { __status: 403 },
    'phimapi.com/phim/ten-phim': { status: true, movie: movie({ slug: 'ten-phim-kkphim' }), episodes: [episode()] }
  });
  const found = await catalog.detail('ten-phim');
  assert.equal(found.source, 'kkphim');
  assert.equal(found.movie.slug, 'ten-phim');
});

test('detail: slug khác hệ thì tìm theo tên rồi mới lấy detail', async () => {
  stub({
    'vsmov.com/api/phim/phim-a': {
      data: {
        movie: movie({ name: 'Vòng Xoáy Tình Yêu', origin_name: 'Love Twist', year: 2021 }),
        episodes: [episode({ link_m3u8: null })]
      }
    },
    'phimapi.com/phim/phim-a': { __status: 404 },
    'phimapi.com/tim-kiem': {
      status: true,
      data: { items: [{ slug: 'vong-xoay-tinh-yeu', name: 'Vòng Xoáy Tình Yêu', origin_name: 'Love Twist', year: 2021 }] }
    },
    'phimapi.com/phim/vong-xoay-tinh-yeu': {
      status: true,
      movie: movie({ slug: 'vong-xoay-tinh-yeu', name: 'Vòng Xoáy Tình Yêu', origin_name: 'Love Twist', year: 2021 }),
      episodes: [episode()]
    }
  });
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'kkphim');
  assert.equal(found.movie.slug, 'phim-a');
  assert.equal(found.episodes[0].server_data[0].link_m3u8, 'https://cdn.test/1.m3u8');
  assert.ok(seenUrls.some((url) => url.includes('/tim-kiem')));
});

test('detail: tên lệch nhưng khác năm thì không ghép bừa, giữ bản VSMOV', async () => {
  stub({
    'vsmov.com/api/phim/phim-a': {
      data: {
        movie: movie({ name: 'Vòng Xoáy Tình Yêu', origin_name: 'Love Twist', year: 2021 }),
        episodes: [episode({ link_m3u8: null })]
      }
    },
    'phimapi.com/phim/phim-a': { __status: 404 },
    'phimapi.com/tim-kiem': {
      status: true,
      data: { items: [{ slug: 'vong-xoay-khac', name: 'Vòng Xoáy Tình Yêu Phần 2', origin_name: 'Love Twist 2', year: 2024 }] }
    }
  });
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'vsmov');
  assert.equal(found.movie.slug, 'phim-a');
});

test('detail: không nguồn nào có phim thì ném lỗi', async () => {
  stub({
    'vsmov.com/api/phim/khong-co': { __status: 404 },
    'phimapi.com/phim/khong-co': { __status: 404 }
  });
  await assert.rejects(() => catalog.detail('khong-co'));
});
test('detail: tên có ngoặc/hậu tố thì tìm thêm bằng tên gốc', async () => {
  stub({
    'vsmov.com/api/phim/ga-kho-chang-trai-tot-bung': {
      data: {
        movie: movie({ slug: 'ga-kho-chang-trai-tot-bung', name: 'Gã Khờ (Chàng Trai Tốt Bụng)', origin_name: 'The Innocent Man', year: 2012 }),
        episodes: [episode({ link_m3u8: null })]
      }
    },
    'phimapi.com/phim/ga-kho-chang-trai-tot-bung': { __status: 404 },
    'phimapi.com/tim-kiem': (parsed) => {
      const keyword = parsed.searchParams.get('keyword');
      const items = keyword === 'The Innocent Man'
        ? [{ slug: 'ga-kho', name: 'Gã Khờ', origin_name: 'The Innocent Man', year: 2012 }]
        : [];
      return { status: true, data: { items } };
    },
    'phimapi.com/phim/ga-kho': {
      status: true,
      movie: movie({ slug: 'ga-kho', name: 'Gã Khờ', origin_name: 'The Innocent Man', year: 2012 }),
      episodes: [episode()]
    }
  });
  const found = await catalog.detail('ga-kho-chang-trai-tot-bung');
  assert.equal(found.source, 'kkphim');
  assert.equal(found.movie.slug, 'ga-kho-chang-trai-tot-bung');
  assert.equal(found.episodes[0].server_data[0].link_m3u8, 'https://cdn.test/1.m3u8');
  const searched = seenUrls.filter((url) => url.includes('/tim-kiem')).map((url) => new URL(url).searchParams.get('keyword'));
  assert.deepEqual(searched, ['Gã Khờ (Chàng Trai Tốt Bụng)', 'Gã Khờ', 'The Innocent Man']);
});
test('detail: bản KKPhim cũng không có m3u8 thì giữ bản VSMOV', async () => {
  stub({
    'vsmov.com/api/phim/phim-a': { data: { movie: movie({ name: 'Phim A (VSMOV)' }), episodes: [episode({ link_m3u8: null })] } },
    'phimapi.com/phim/phim-a': { status: true, movie: movie({ name: 'Phim A (KKPhim)' }), episodes: [episode({ link_m3u8: null })] }
  });
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'vsmov');
  assert.equal(found.movie.name, 'Phim A (VSMOV)');
});