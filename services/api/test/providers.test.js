/**
 * Tầng nguồn catalog: resolver (fallback, circuit breaker, khớp slug chéo nguồn,
 * bồi metadata) và adapter TMDB.
 *
 * Không request mạng nào: nguồn giả dựng ngay trong file, còn TMDB thì thay
 * `globalThis.fetch`. Nhờ vậy test chạy được cả trên CI không có khoá API.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

// TMDB đọc khoá và base URL ở cấp module, nên phải đặt biến môi trường TRƯỚC khi
// import — vì vậy file này dùng `await import` chứ không dùng import tĩnh.
process.env.TMDB_API_KEY = 'khoa-test';
process.env.TMDB_LANGUAGE = 'vi-VN';
process.env.TMDB_API_URL = 'https://tmdb.test/3';
process.env.TMDB_IMAGE_BASE = 'https://img.test';
delete process.env.TMDB_ACCESS_TOKEN;

const { CatalogResolver } = await import('../dist/providers/resolver.js');
const { MATCH_THRESHOLD, checkList, enrich, imageUrl, makePagination, matchScore } =
  await import('../dist/providers/normalize.js');
const { clearHttpCache } = await import('../dist/providers/http.js');
const { makeSlug, parseSlug, resetTmdbCaches, tmdb, tmdbEnabled } = await import('../dist/providers/tmdb.js');

// Resolver cố tình log mỗi lần một nguồn lỗi; ở đây lỗi là điều đang được test nên
// tắt cho khỏi lẫn vào kết quả. Mỗi file test chạy trong process riêng.
console.warn = () => {};

const movie = (over = {}) => ({
  provider: 'fake', providerId: '1', slug: 'phim-a', name: 'Phim A', originName: null,
  description: null, type: 'single', status: null, year: null, duration: null, quality: null,
  language: null, posterUrl: null, thumbUrl: null, trailerUrl: null, rating: null,
  viewCount: 0, tmdbId: null, imdbId: null, genres: [], countries: [], actors: [], directors: [],
  ...over
});
const page = (items) => ({
  items,
  pagination: { totalItems: items.length, totalPages: 1, currentPage: 1, totalItemsPerPage: 24 }
});
const episodes = (count = 1) => [{
  server_name: 'Server #1',
  server_data: Array.from({ length: count }, (_, index) => ({
    name: String(index + 1), link_embed: `https://embed.test/${index + 1}`, link_m3u8: null
  }))
}];

test('fallback: nguồn đầu lỗi thì rơi xuống nguồn sau', async () => {
  const calls = [];
  const catalog = new CatalogResolver([
    { name: 'dead', kind: 'playable', latest: async () => { calls.push('dead'); throw new Error('sập'); } },
    { name: 'alive', kind: 'playable', latest: async () => { calls.push('alive'); return page([movie()]); } }
  ]);
  const result = await catalog.latest(1);
  assert.deepEqual(calls, ['dead', 'alive']);
  assert.equal(result.source, 'alive');
  assert.equal(result.items.length, 1);
});

test('nguồn trả 200 nhưng sai shape bị tính là lỗi và rơi xuống nguồn sau', async () => {
  const catalog = new CatalogResolver([
    { name: 'lech', kind: 'playable', latest: async () => page([{ name: 'thiếu gần hết field' }]) },
    { name: 'chuan', kind: 'playable', latest: async () => page([movie()]) }
  ]);
  const result = await catalog.latest(1);
  assert.equal(result.source, 'chuan');
  const health = catalog.status().find((row) => row.name === 'lech');
  assert.match(health.lastError, /Nguồn lech trả dữ liệu sai shape/);
});

test('mọi nguồn đổ: lỗi 502 kể tên từng nguồn kèm lý do', async () => {
  const catalog = new CatalogResolver([
    { name: 'mot', kind: 'playable', latest: async () => { throw new Error('hết hạn'); } },
    { name: 'hai', kind: 'playable', latest: async () => { throw new Error('quá tải'); } }
  ]);
  await assert.rejects(() => catalog.latest(1), (error) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /mot: hết hạn/);
    assert.match(error.message, /hai: quá tải/);
    return true;
  });
});

test('nguồn thiếu method thì bị bỏ qua, không bị gọi rồi nổ', async () => {
  let touched = false;
  const catalog = new CatalogResolver([
    { name: 'khong-co-genre', kind: 'playable', latest: async () => { touched = true; return page([]); } },
    { name: 'co-genre', kind: 'metadata', byGenre: async () => page([movie()]) }
  ]);
  const result = await catalog.byGenre('hanh-dong');
  assert.equal(result.source, 'co-genre');
  assert.equal(touched, false);
});

test('không nguồn nào hỗ trợ khả năng đang cần: lỗi 501', async () => {
  const catalog = new CatalogResolver([{ name: 'chi-co-latest', kind: 'playable', latest: async () => page([]) }]);
  await assert.rejects(() => catalog.codes(), (error) => {
    assert.equal(error.status, 501);
    assert.match(error.message, /codes/);
    return true;
  });
});

test('circuit breaker: lỗi 3 lần liên tiếp thì nguồn bị tạm ngừng gọi', async () => {
  let deadCalls = 0;
  const catalog = new CatalogResolver([
    { name: 'dead', kind: 'playable', latest: async () => { deadCalls += 1; throw new Error('sập'); } },
    { name: 'alive', kind: 'playable', latest: async () => page([movie()]) }
  ]);
  for (let round = 0; round < 3; round += 1) await catalog.latest(1);
  assert.equal(deadCalls, 3);

  const opened = catalog.status().find((row) => row.name === 'dead');
  assert.equal(opened.healthy, false);
  assert.equal(opened.failures, 3);
  assert.ok(opened.openUntil, 'phải có thời điểm circuit đóng lại');
  assert.ok(new Date(opened.openUntil).getTime() > Date.now());

  // Request thứ tư không tốn thêm một lần chờ timeout của nguồn chết nữa.
  const result = await catalog.latest(1);
  assert.equal(result.source, 'alive');
  assert.equal(deadCalls, 3);
});

test('circuit breaker: nguồn trả lời được thì đếm lỗi về 0', async () => {
  let fail = true;
  const catalog = new CatalogResolver([
    { name: 'that-thuong', kind: 'playable', latest: async () => { if (fail) throw new Error('sập'); return page([movie()]); } },
    { name: 'du-phong', kind: 'playable', latest: async () => page([movie()]) }
  ]);
  await catalog.latest(1);
  await catalog.latest(1);
  assert.equal(catalog.status().find((row) => row.name === 'that-thuong').failures, 2);

  fail = false;
  const result = await catalog.latest(1);
  assert.equal(result.source, 'that-thuong');
  const health = catalog.status().find((row) => row.name === 'that-thuong');
  assert.equal(health.failures, 0);
  assert.equal(health.healthy, true);
  assert.equal(health.lastError, null);
  assert.ok(health.lastSuccessAt);
});

test('status() liệt kê đúng khả năng của từng nguồn', async () => {
  const catalog = new CatalogResolver([
    { name: 'phat', kind: 'playable', latest: async () => page([]), detail: async () => ({ movie: movie(), episodes: [] }) },
    { name: 'mo-ta', kind: 'metadata', genres: async () => ({ items: [] }) }
  ]);
  const [playable, metadata] = catalog.status();
  assert.deepEqual(catalog.names, ['phat', 'mo-ta']);
  assert.deepEqual(playable.capabilities, ['latest', 'detail']);
  assert.equal(playable.kind, 'playable');
  assert.deepEqual(metadata.capabilities, ['genres']);
  assert.equal(metadata.kind, 'metadata');
});

test('detail: nguồn phát làm gốc dù nguồn metadata đứng trước', async () => {
  const catalog = new CatalogResolver([
    {
      name: 'meta', kind: 'metadata',
      detail: async (slug) => ({
        movie: movie({ provider: 'meta', slug, name: 'Tên theo TMDB', description: 'mô tả của TMDB', posterUrl: 'https://img.test/w500/p.jpg', year: 2018, rating: 8.3, actors: ['Ngô Cẩn Ngôn'] }),
        episodes: []
      })
    },
    {
      name: 'phat', kind: 'playable',
      detail: async (slug) => ({
        movie: movie({ provider: 'phat', slug, name: 'Tên theo nguồn phát', description: 'mô tả của nguồn phát', quality: 'FHD' }),
        episodes: episodes(3)
      })
    }
  ]);
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'phat');
  assert.equal(found.playable, true);
  assert.equal(found.episodes[0].server_data.length, 3);
  // Nguồn phát là sự thật về phim nó phát: tên và mô tả không bị metadata ghi đè.
  assert.equal(found.movie.name, 'Tên theo nguồn phát');
  assert.equal(found.movie.description, 'mô tả của nguồn phát');
  // Còn field đang trống thì được bồi.
  assert.equal(found.movie.posterUrl, 'https://img.test/w500/p.jpg');
  assert.equal(found.movie.year, 2018);
  assert.equal(found.movie.rating, 8.3);
  assert.deepEqual(found.movie.actors, ['Ngô Cẩn Ngôn']);
  assert.deepEqual(found.enrichedBy, ['meta']);
});

test('detail: nguồn phát có tập được ưu tiên hơn nguồn phát không có tập', async () => {
  const catalog = new CatalogResolver([
    { name: 'rong', kind: 'playable', detail: async (slug) => ({ movie: movie({ provider: 'rong', slug }), episodes: [] }) },
    { name: 'co-tap', kind: 'playable', detail: async (slug) => ({ movie: movie({ provider: 'co-tap', slug }), episodes: episodes(2) }) }
  ]);
  const found = await catalog.detail('phim-a');
  assert.equal(found.source, 'co-tap');
  assert.equal(found.playable, true);
});

test('detail: chỉ có metadata thì trả về kèm playable=false', async () => {
  const catalog = new CatalogResolver([
    { name: 'phat', kind: 'playable', detail: async () => { throw new Error('không có phim này'); } },
    { name: 'meta', kind: 'metadata', detail: async (slug) => ({ movie: movie({ provider: 'meta', slug }), episodes: [] }) }
  ]);
  const found = await catalog.detail('phim-chi-co-mo-ta');
  assert.equal(found.source, 'meta');
  assert.equal(found.playable, false);
  assert.deepEqual(found.episodes, []);
});

test('detail: không nguồn nào có phim thì lỗi 404 kèm lý do từng nguồn', async () => {
  const catalog = new CatalogResolver([
    { name: 'phat', kind: 'playable', detail: async () => { throw new Error('404 ở nguồn phát'); } },
    { name: 'meta', kind: 'metadata', detail: async () => { throw new Error('404 ở nguồn metadata'); } }
  ]);
  await assert.rejects(() => catalog.detail('khong-ton-tai'), (error) => {
    assert.equal(error.status, 404);
    assert.match(error.message, /404 ở nguồn phát/);
    assert.match(error.message, /404 ở nguồn metadata/);
    return true;
  });
});

/** Hai nguồn đặt slug khác nhau cho cùng một phim — đây là ca hay gặp nhất. */
function reconcilingSources(candidate) {
  const calls = { search: 0, detail: [] };
  const sources = [
    {
      name: 'vsmov', kind: 'playable',
      detail: async (slug) => ({
        movie: movie({ provider: 'vsmov', slug, name: 'Diên Hy Công Lược', year: 2018, type: 'series' }),
        episodes: episodes(70)
      })
    },
    {
      name: 'meta', kind: 'metadata',
      detail: async (slug) => {
        calls.detail.push(slug);
        if (slug !== 'dien-hy-cong-luoc-t900') throw new Error(`Slug "${slug}" không phải slug của meta`);
        return {
          movie: movie({
            provider: 'meta', slug, name: 'Diên Hy Công Lược', year: 2018,
            description: 'Ngụy Anh Lạc vào Tử Cấm Thành', posterUrl: 'https://img.test/w500/dienhy.jpg',
            rating: 8.3, actors: ['Ngô Cẩn Ngôn', 'Xa Thi Mạn']
          }),
          episodes: []
        };
      },
      search: async () => { calls.search += 1; return page([candidate]); }
    }
  ];
  return { calls, catalog: new CatalogResolver(sources) };
}

test('detail: slug lệch nhau thì tìm lại bằng tên + năm rồi bồi metadata', async () => {
  const { calls, catalog } = reconcilingSources(movie({
    provider: 'meta', slug: 'dien-hy-cong-luoc-t900', name: 'Diên Hy Công Lược', year: 2018
  }));
  const found = await catalog.detail('dien-hy-cong-luoc');
  assert.equal(found.source, 'vsmov');
  assert.equal(found.playable, true);
  assert.deepEqual(found.enrichedBy, ['meta']);
  assert.equal(found.movie.posterUrl, 'https://img.test/w500/dienhy.jpg');
  assert.equal(found.movie.rating, 8.3);
  assert.equal(calls.search, 1);
  assert.deepEqual(calls.detail, ['dien-hy-cong-luoc', 'dien-hy-cong-luoc-t900']);
});

test('detail: cặp slug đã khớp được ghi nhớ, lần sau không tìm lại nữa', async () => {
  const { calls, catalog } = reconcilingSources(movie({
    provider: 'meta', slug: 'dien-hy-cong-luoc-t900', name: 'Diên Hy Công Lược', year: 2018
  }));
  await catalog.detail('dien-hy-cong-luoc');
  calls.detail.length = 0;
  const again = await catalog.detail('dien-hy-cong-luoc');
  assert.equal(again.movie.rating, 8.3);
  assert.equal(calls.search, 1, 'không được gọi search lần thứ hai');
  assert.deepEqual(calls.detail, ['dien-hy-cong-luoc-t900']);
});

test('detail: phim không đủ giống thì thà thiếu metadata còn hơn gán sai', async () => {
  const { calls, catalog } = reconcilingSources(movie({
    provider: 'meta', slug: 'phim-hoan-toan-khac-m12', name: 'Phim Hoàn Toàn Khác', year: 2005
  }));
  const found = await catalog.detail('dien-hy-cong-luoc');
  assert.equal(found.source, 'vsmov');
  assert.deepEqual(found.enrichedBy, []);
  assert.equal(found.movie.posterUrl, null);
  assert.equal(calls.search, 1);
});

test('enrich chỉ lấp chỗ trống, không bao giờ ghi đè', () => {
  const base = movie({ description: 'mô tả gốc', genres: ['Cổ Trang'], posterUrl: null, actors: [] });
  const merged = enrich(base, movie({
    description: 'mô tả mới', posterUrl: 'https://img.test/w500/p.jpg', genres: ['Hành Động'],
    actors: ['Ai Đó'], name: 'Tên khác', quality: 'HD'
  }));
  assert.equal(merged.description, 'mô tả gốc');
  assert.deepEqual(merged.genres, ['Cổ Trang']);
  assert.equal(merged.posterUrl, 'https://img.test/w500/p.jpg');
  assert.deepEqual(merged.actors, ['Ai Đó']);
  // Ngoài danh sách được phép bồi: tên và chất lượng vẫn của nguồn gốc.
  assert.equal(merged.name, 'Phim A');
  assert.equal(merged.quality, null);
  assert.equal(base.posterUrl, null, 'không được sửa vào object đầu vào');
});

test('matchScore: cùng phim thì cao, khác phim thì dưới ngưỡng', () => {
  const reference = { name: 'Diên Hy Công Lược', originName: 'Story of Yanxi Palace', year: 2018 };
  assert.ok(matchScore(reference, { name: 'Diên Hy Công Lược', year: 2018 }) >= MATCH_THRESHOLD);
  assert.ok(matchScore(reference, { name: 'Story of Yanxi Palace', year: 2018 }) >= MATCH_THRESHOLD);
  // Lệch một năm là chuyện thường của ngày phát hành theo quốc gia.
  assert.ok(matchScore(reference, { name: 'Diên Hy Công Lược', year: 2019 }) >= MATCH_THRESHOLD);
  assert.ok(matchScore(reference, { name: 'Phim Hoàn Toàn Khác', year: 2005 }) < MATCH_THRESHOLD);
  // Lệch năm nhiều thì bị trừ nặng dù tên giống.
  assert.ok(matchScore(reference, { name: 'Diên Hy Công Lược', year: 2005 }) <
    matchScore(reference, { name: 'Diên Hy Công Lược', year: 2018 }));
  assert.equal(matchScore({ name: null, originName: null }, { name: 'Gì Cũng Được' }), 0);
});

test('imageUrl chỉ nhận http(s) tuyệt đối', () => {
  assert.equal(imageUrl('https://img.test/a.jpg'), 'https://img.test/a.jpg');
  assert.equal(imageUrl('/upload/a.jpg'), null);
  assert.equal(imageUrl('data:image/png;base64,AAAA'), null);
  assert.equal(imageUrl('  '), null);
  assert.equal(imageUrl(null), null);
});

test('makePagination vá số liệu thiếu của nguồn', () => {
  assert.deepEqual(makePagination({ totalItems: 100, limit: 24, itemCount: 24 }), {
    totalItems: 100, totalPages: 5, currentPage: 1, totalItemsPerPage: 24
  });
  // Nguồn trả currentPage vượt totalPages thì kẹp lại, không để web hiện trang trống.
  assert.equal(makePagination({ totalItems: 10, totalPages: 1, currentPage: 9, limit: 24, itemCount: 10 }).currentPage, 1);
  assert.equal(makePagination({ itemCount: 3 }).totalItems, 3);
});

test('checkList nói rõ nguồn nào sai ở field nào', () => {
  assert.throws(() => checkList('vsmov', page([movie({ slug: 'slug có dấu cách' })])), (error) => {
    assert.match(error.message, /Nguồn vsmov trả dữ liệu sai shape/);
    assert.match(error.message, /items\.0\.slug/);
    return true;
  });
});

// ---------------------------------------------------------------------------
// TMDB: thay `fetch` bằng router theo pathname, không gọi mạng.
// ---------------------------------------------------------------------------

const GENRES = {
  '/3/genre/movie/list': { genres: [{ id: 28, name: 'Hành Động' }, { id: 16, name: 'Hoạt Hình' }, { id: 18, name: 'Chính Kịch' }] },
  '/3/genre/tv/list': { genres: [{ id: 10765, name: 'Khoa Học & Viễn Tưởng' }] }
};

let routes = {};
let failWith = {};
let requests = [];

globalThis.fetch = async (url) => {
  const parsed = new URL(String(url));
  requests.push(parsed);
  const status = failWith[parsed.pathname];
  if (status) return { ok: false, status, json: async () => ({}) };
  const body = routes[parsed.pathname];
  if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => body };
};

function stub(extra = {}, failures = {}) {
  clearHttpCache();
  resetTmdbCaches();
  requests = [];
  routes = { ...GENRES, ...extra };
  failWith = failures;
}

const asked = (pathname) => requests.filter((url) => url.pathname === pathname);

test('tmdbEnabled bật khi có khoá, và mọi request đều mang khoá + ngôn ngữ', async () => {
  assert.equal(tmdbEnabled, true);
  stub({ '/3/movie/now_playing': { page: 1, total_pages: 2, total_results: 30, results: [] } });
  await tmdb.latest(1);
  const call = asked('/3/movie/now_playing')[0];
  assert.equal(call.searchParams.get('api_key'), 'khoa-test');
  assert.equal(call.searchParams.get('language'), 'vi-VN');
});

test('makeSlug/parseSlug đi được cả hai chiều', () => {
  assert.equal(makeSlug('Diên Hy Công Lược', 'tv', 900), 'dien-hy-cong-luoc-t900');
  assert.equal(makeSlug('Kẻ Trộm Mặt Trăng', 'movie', 20352), 'ke-trom-mat-trang-m20352');
  assert.deepEqual(parseSlug('dien-hy-cong-luoc-t900'), { kind: 'tv', id: 900 });
  assert.deepEqual(parseSlug('ke-trom-mat-trang-m20352'), { kind: 'movie', id: 20352 });
  assert.equal(parseSlug('phim-cua-nguon-khac'), null);
  // Tên rỗng vẫn phải ra slug hợp lệ, vì slug đi vào URL.
  assert.equal(makeSlug('###', 'movie', 7), 'phim-m7');
});

test('tmdb.detail ánh xạ đủ field và không bao giờ trả tập phim', async () => {
  stub({
    '/3/tv/900': {
      id: 900, name: 'Diên Hy Công Lược', original_name: '延禧攻略',
      overview: 'Ngụy Anh Lạc vào Tử Cấm Thành.', status: 'Ended', first_air_date: '2018-07-19',
      episode_run_time: [45], original_language: 'zh', poster_path: '/p.jpg', backdrop_path: '/b.jpg',
      vote_average: 8.3, genres: [{ id: 18, name: 'Chính Kịch' }],
      production_countries: [{ name: 'Trung Quốc' }],
      credits: {
        cast: Array.from({ length: 25 }, (_, index) => ({ name: `Diễn viên ${index + 1}` })),
        crew: [{ job: 'Director', name: 'Huệ Khai Đông' }, { job: 'Writer', name: 'Chu Mạt' }]
      },
      external_ids: { imdb_id: 'tt8646580' },
      videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abc123' }] }
    }
  });
  const { movie: found, episodes: eps } = await tmdb.detail('dien-hy-cong-luoc-t900');
  assert.equal(found.provider, 'tmdb');
  assert.equal(found.slug, 'dien-hy-cong-luoc-t900');
  assert.equal(found.name, 'Diên Hy Công Lược');
  assert.equal(found.originName, '延禧攻略');
  assert.equal(found.type, 'series');
  assert.equal(found.status, 'completed');
  assert.equal(found.year, 2018);
  assert.equal(found.duration, '45 phút');
  assert.equal(found.posterUrl, 'https://img.test/w500/p.jpg');
  assert.equal(found.thumbUrl, 'https://img.test/w1280/b.jpg');
  assert.equal(found.trailerUrl, 'https://www.youtube.com/watch?v=abc123');
  assert.equal(found.imdbId, 'tt8646580');
  assert.equal(found.tmdbId, '900');
  assert.equal(found.rating, 8.3);
  assert.deepEqual(found.genres, ['Chính Kịch']);
  assert.deepEqual(found.countries, ['Trung Quốc']);
  assert.equal(found.actors.length, 20, 'dàn diễn viên bị cắt còn 20');
  assert.deepEqual(found.directors, ['Huệ Khai Đông']);
  assert.deepEqual(eps, [], 'nguồn metadata không được đoán link phát');
  assert.equal(asked('/3/tv/900')[0].searchParams.get('append_to_response'), 'credits,external_ids,videos');
});

test('tmdb.detail: slug của nguồn khác bị từ chối trước khi gọi mạng', async () => {
  stub();
  await assert.rejects(() => tmdb.detail('phim-cua-vsmov'), (error) => {
    assert.equal(error.status, 404);
    assert.equal(requests.length, 0);
    return true;
  });
});

test('tmdb.search: bỏ người, đổi genre_ids thành tên, phân trang 20/trang', async () => {
  stub({
    '/3/search/multi': {
      page: 2, total_pages: 3, total_results: 44,
      results: [
        { id: 1, title: 'Phim Lẻ', genre_ids: [28], poster_path: '/a.jpg', release_date: '2020-01-01' },
        { id: 2, name: 'Phim Bộ Hoạt Hình', first_air_date: '2019-05-05', genre_ids: [16] },
        { media_type: 'person', id: 3, name: 'Một Diễn Viên' }
      ]
    }
  });
  const result = await tmdb.search('phim', { page: 2 });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].slug, 'phim-le-m1');
  assert.deepEqual(result.items[0].genres, ['Hành Động']);
  assert.equal(result.items[0].type, 'single');
  assert.equal(result.items[1].slug, 'phim-bo-hoat-hinh-t2');
  assert.equal(result.items[1].type, 'hoathinh');
  assert.equal(result.items[1].year, 2019);
  assert.deepEqual(result.pagination, { totalItems: 44, totalPages: 3, currentPage: 2, totalItemsPerPage: 20 });
});

test('tmdb: slug danh sách/thể loại/quốc gia không hiểu được thì 404, không gọi bừa', async () => {
  stub({ '/3/discover/movie': { page: 1, total_pages: 1, total_results: 0, results: [] } });
  await assert.rejects(() => tmdb.list('phim-khong-co-that'), (error) => error.status === 404);
  await assert.rejects(() => tmdb.byGenre('the-loai-bia'), (error) => error.status === 404);
  await assert.rejects(() => tmdb.byCountry('viet-nam'), (error) => error.status === 404);
  assert.equal(asked('/3/discover/movie').length, 0);

  await tmdb.byGenre('hanh-dong', { page: 3 });
  const call = asked('/3/discover/movie')[0];
  assert.equal(call.searchParams.get('with_genres'), '28');
  assert.equal(call.searchParams.get('page'), '3');

  await tmdb.byCountry('kr');
  assert.equal(asked('/3/discover/movie')[1].searchParams.get('with_origin_country'), 'KR');
});

test('tmdb.years dựng sẵn 30 năm, không cần endpoint nào', async () => {
  stub();
  const { items } = await tmdb.years();
  assert.equal(items.length, 30);
  assert.equal(items[0].slug, String(new Date().getFullYear()));
  assert.equal(requests.length, 0);
});

test('tmdb: HTTP 401 báo là lỗi cấu hình khoá, không phải nguồn chết', async () => {
  stub({}, { '/3/person/popular': 401 });
  await assert.rejects(() => tmdb.actors(), (error) => {
    assert.match(error.message, /Nguồn tmdb trả HTTP 401/);
    assert.match(error.message, /kiểm tra khoá API/);
    return true;
  });
});
