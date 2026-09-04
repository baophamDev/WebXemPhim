/**
 * Adapter TheTVDB v4: đăng nhập lấy token, ánh xạ field, và những chỗ nó cố tình
 * từ chối làm việc (slug của nguồn khác, quốc gia không phải mã ba chữ).
 *
 * Không request mạng nào: `globalThis.fetch` bị thay bằng một router theo pathname,
 * nên test chạy được cả trên CI không có khoá TVDB. Adapter đọc biến môi trường ở
 * cấp module nên phải đặt biến **trước** khi import — vì vậy file này dùng
 * `await import` chứ không dùng import tĩnh.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.TVDB_API_KEY = 'khoa-tvdb';
process.env.TVDB_PIN = 'pin-test';
process.env.TVDB_API_URL = 'https://tvdb.test/v4';
process.env.TVDB_LANGUAGE = 'vie';
// Hai nước là đủ để thấy việc gộp nhiều nước, mà stub không phải dài ra.
process.env.TVDB_COUNTRIES = 'chn,kor';

const { makeSlug, parseSlug, resetTvdbCaches, tvdb, tvdbEnabled } = await import('../dist/providers/tvdb.js');
const { clearHttpCache } = await import('../dist/providers/http.js');

console.warn = () => {};

let routes = {};
let failWith = {};
let calls = [];

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url));
  calls.push({ url: parsed, init });
  // Mảng trạng thái lỗi bị `shift()` dần: nhờ đó viết được "lỗi lần đầu, lần sau ổn".
  const planned = failWith[parsed.pathname];
  const status = Array.isArray(planned) ? planned.shift() : planned;
  if (status) return { ok: false, status, json: async () => ({}) };
  const body = routes[parsed.pathname];
  if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => (typeof body === 'function' ? body(parsed) : body) };
};

const LOGIN = { '/v4/login': { data: { token: 'tok-1' } } };

function stub(extra = {}, failures = {}) {
  clearHttpCache();
  resetTvdbCaches();
  calls = [];
  routes = { ...LOGIN, ...extra };
  failWith = failures;
}

const asked = (pathname) => calls.filter((call) => call.url.pathname === pathname);
const param = (pathname, key, index = 0) => asked(pathname)[index]?.url.searchParams.get(key);
const seriesItem = (id, name) => ({ id: `series-${id}`, type: 'series', name, year: '2020' });

test('tvdbEnabled bật khi có khoá; nhiều request đang chờ chỉ đăng nhập một lần', async () => {
  assert.equal(tvdbEnabled, true);
  stub({ '/v4/series/filter': { data: [], links: {} } });
  // TVDB đếm số lần đăng nhập, nên `authorize()` phải gộp mọi request đang chờ vào
  // một lần `POST /login` thay vì mỗi request một lần.
  await Promise.all([tvdb.latest(1), tvdb.home({ page: 2 })]);
  assert.equal(asked('/v4/login').length, 1);
  const login = asked('/v4/login')[0];
  assert.equal(login.init.method, 'POST');
  assert.deepEqual(JSON.parse(login.init.body), { apikey: 'khoa-tvdb', pin: 'pin-test' });
  const filter = asked('/v4/series/filter')[0];
  assert.equal(filter.init.headers.authorization, 'Bearer tok-1');
  assert.equal(filter.init.headers['accept-language'], 'vie');
  // `/series/filter` bắt buộc có country + lang, và trang đánh số từ 0.
  assert.equal(filter.url.searchParams.get('lang'), 'vie');
  assert.equal(filter.url.searchParams.get('country'), 'chn');
  assert.equal(filter.url.searchParams.get('page'), '0');
});

test('makeSlug/parseSlug đi được cả hai chiều, và không nhận nhầm slug TMDB', async () => {
  assert.equal(makeSlug('Diên Hy Công Lược', 'series', 72108), 'dien-hy-cong-luoc-v72108s');
  assert.equal(makeSlug('Kẻ Trộm Mặt Trăng', 'movie', 20352), 'ke-trom-mat-trang-v20352f');
  assert.deepEqual(parseSlug('dien-hy-cong-luoc-v72108s'), { kind: 'series', id: 72108 });
  assert.deepEqual(parseSlug('ke-trom-mat-trang-v20352f'), { kind: 'movie', id: 20352 });
  // Tên rỗng vẫn phải ra slug hợp lệ, vì slug đi vào URL.
  assert.equal(makeSlug('###', 'movie', 7), 'phim-v7f');
  // Hậu tố cố tình khác `-m###`/`-t###` của TMDB: hai nguồn không được nhận slug
  // của nhau, nếu không thì một nguồn sẽ đi gọi mạng bằng id của nguồn kia.
  assert.equal(parseSlug('dien-hy-cong-luoc-t900'), null);
  const { parseSlug: parseTmdbSlug } = await import('../dist/providers/tmdb.js');
  assert.equal(parseTmdbSlug('dien-hy-cong-luoc-v72108s'), null);
});

test('401 giữa đường: bỏ token, đăng nhập lại rồi thử lại đúng một lần', async () => {
  stub({ '/v4/search': { data: [], links: {} } }, { '/v4/search': [401] });
  const found = await tvdb.search('diên hy', { page: 1 });
  assert.deepEqual(found.items, []);
  assert.equal(asked('/v4/search').length, 2);
  // TVDB trả 401 cho cả "token hết hạn" và "khoá sai"; cách phân biệt duy nhất là
  // xin token mới xem có đỡ không.
  assert.equal(asked('/v4/login').length, 2);
});

test('401 lần thứ hai thì báo lỗi cấu hình khoá, không lặp vô hạn', async () => {
  stub({ '/v4/search': { data: [] } }, { '/v4/search': [401, 401] });
  await assert.rejects(() => tvdb.search('gì cũng được'), (error) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /HTTP 401/);
    assert.match(error.message, /khoá API/);
    return true;
  });
  assert.equal(asked('/v4/search').length, 2, 'chỉ được thử lại một lần');
});

test('search: ánh xạ snake_case, đánh trang từ 0, bỏ item thiếu id hoặc tên', async () => {
  stub({
    '/v4/search': {
      data: [
        {
          id: 'series-72108', type: 'series', name: 'Story of Yanxi Palace',
          translations: { vie: 'Diên Hy Công Lược' }, overviews: { vie: 'Ngụy Anh Lạc vào Tử Cấm Thành' },
          original_name: '延禧攻略', year: '2018', primary_language: 'zho', country: 'chn',
          image_url: 'https://artworks.test/p.jpg', genres: ['Drama']
        },
        { id: 'movie-1234', type: 'movie', name: 'Kẻ Trộm Mặt Trăng', year: '2010' },
        { id: 'series-9', type: 'series' }
      ],
      links: { total_items: 41 }
    }
  });
  const found = await tvdb.search('diên hy', { page: 2 });
  assert.equal(param('/v4/search', 'query'), 'diên hy');
  // Search của TVDB đánh trang từ 0, khác phần còn lại của API đó.
  assert.equal(param('/v4/search', 'page'), '1');
  assert.equal(found.items.length, 2, 'item thiếu tên bị bỏ, không được thành phim tên rỗng');
  const [first, second] = found.items;
  assert.equal(first.provider, 'tvdb');
  // Slug dựng từ tên đã dịch, và id lấy được từ dạng `"series-72108"`.
  assert.equal(first.slug, 'dien-hy-cong-luoc-v72108s');
  assert.equal(first.providerId, '72108');
  assert.equal(first.name, 'Diên Hy Công Lược');
  assert.equal(first.originName, '延禧攻略');
  assert.equal(first.description, 'Ngụy Anh Lạc vào Tử Cấm Thành');
  assert.equal(first.year, 2018);
  assert.equal(first.type, 'series');
  assert.equal(first.posterUrl, 'https://artworks.test/p.jpg');
  assert.deepEqual(first.genres, ['Drama']);
  assert.deepEqual(first.countries, ['chn']);
  assert.equal(second.slug, 'ke-trom-mat-trang-v1234f');
  assert.equal(second.type, 'single');
  assert.equal(found.pagination.totalItems, 41);
  assert.equal(found.pagination.totalPages, 3);
  assert.equal(found.pagination.currentPage, 2);
});

test('detail: ưu tiên bản dịch, tách đạo diễn khỏi diễn viên, không trả tập', async () => {
  stub({
    '/v4/series/72108/extended': {
      data: {
        id: 72108, name: 'Story of Yanxi Palace', originalName: '延禧攻略',
        overview: 'Yingluo enters the palace', averageRuntime: 45, score: 218743,
        status: { name: 'Ended' }, firstAired: '2018-07-19',
        originalLanguage: 'zho', originalCountry: 'chn', image: 'https://artworks.test/p.jpg',
        genres: [{ name: 'Drama' }, { name: 'Romance' }],
        translations: {
          nameTranslations: [
            { language: 'eng', name: 'Story of Yanxi Palace' },
            { language: 'vie', name: 'Diên Hy Công Lược' }
          ],
          overviewTranslations: [{ language: 'vie', overview: 'Ngụy Anh Lạc vào Tử Cấm Thành' }]
        },
        remoteIds: [{ sourceName: 'TheMovieDB.com', id: '73586' }, { sourceName: 'IMDB', id: 'tt8646580' }],
        characters: [
          { personName: 'Ngô Cẩn Ngôn', peopleType: 'Actor' },
          { personName: 'Xa Thi Mạn', peopleType: 'Actor' },
          { personName: 'Huệ Khai Đông', peopleType: 'Director' }
        ],
        trailers: [{ url: 'https://youtube.test/watch?v=abc' }]
      }
    }
  });
  const { movie: found, episodes } = await tvdb.detail('dien-hy-cong-luoc-v72108s');
  assert.equal(param('/v4/series/72108/extended', 'meta'), 'translations');
  assert.equal(found.provider, 'tvdb');
  assert.equal(found.slug, 'dien-hy-cong-luoc-v72108s');
  assert.equal(found.providerId, '72108');
  // `/extended` trả bản dịch dạng mảng, khác dạng object của `/search`.
  assert.equal(found.name, 'Diên Hy Công Lược');
  assert.equal(found.description, 'Ngụy Anh Lạc vào Tử Cấm Thành');
  assert.equal(found.status, 'completed');
  assert.equal(found.year, 2018);
  assert.equal(found.duration, '45 phút');
  assert.equal(found.language, 'zho');
  assert.equal(found.posterUrl, 'https://artworks.test/p.jpg');
  assert.equal(found.trailerUrl, 'https://youtube.test/watch?v=abc');
  assert.equal(found.tmdbId, '73586');
  assert.equal(found.imdbId, 'tt8646580');
  assert.deepEqual(found.actors, ['Ngô Cẩn Ngôn', 'Xa Thi Mạn']);
  assert.deepEqual(found.directors, ['Huệ Khai Đông']);
  assert.deepEqual(found.genres, ['Drama', 'Romance']);
  assert.deepEqual(found.countries, ['chn']);
  // `score` của TVDB là điểm phổ biến hàng nghìn, không phải thang 10: để trống cho
  // TMDB bồi, chứ đưa vào `rating` thì trang chi tiết hiện "218743/10".
  assert.equal(found.rating, null);
  // Nguồn metadata có thứ tự tập nhưng không có link phát; trả mảng tập rỗng-link
  // vào đây thì người xem bấm vào tập rồi không có gì chạy.
  assert.deepEqual(episodes, []);
});

test('detail: slug của nguồn khác bị từ chối trước khi gọi mạng', async () => {
  stub();
  await assert.rejects(() => tvdb.detail('dien-hy-cong-luoc-t900'), (error) => {
    assert.equal(error.status, 404);
    return true;
  });
  assert.equal(calls.length, 0, 'không được gọi mạng, kể cả /login');
});

test('byCountry: chỉ nhận mã ba chữ, không đoán slug của nguồn khác', async () => {
  stub({ '/v4/series/filter': { data: [seriesItem(11, 'Hậu Duệ Mặt Trời')], links: {} } });
  // `han-quoc` là slug của nguồn phát; filter của TVDB nhận `kor`. Đoán bừa thì ra
  // phim của nước khác — sai kiểu đó khó thấy hơn là không trả gì.
  await assert.rejects(() => tvdb.byCountry('han-quoc'), (error) => {
    assert.equal(error.status, 404);
    assert.match(error.message, /ba chữ/);
    return true;
  });
  assert.equal(calls.length, 0, 'slug không hợp lệ thì không gọi mạng');
  const found = await tvdb.byCountry('KOR');
  assert.equal(param('/v4/series/filter', 'country'), 'kor', 'mã được hạ chữ thường');
  assert.equal(param('/v4/series/filter', 'lang'), 'vie');
  assert.equal(param('/v4/series/filter', 'page'), '0');
  assert.equal(found.items.length, 1);
  assert.equal(found.items[0].slug, 'hau-due-mat-troi-v11s');
  // Hỏi đúng một nước thì gọi một request, không gộp theo TVDB_COUNTRIES.
  assert.equal(asked('/v4/series/filter').length, 1);
});

test('list: slug lạ báo 404; bảng thể loại chỉ tải một lần', async () => {
  stub({
    '/v4/genres': { data: [{ id: 2, name: 'Animation', slug: 'animation' }, { id: 7, name: 'Chính Kịch' }] },
    '/v4/series/filter': { data: [seriesItem(31, 'Thất Nghiệp Chuyển Sinh')], links: {} }
  });
  await assert.rejects(() => tvdb.list('phim-khong-co'), (error) => {
    assert.equal(error.status, 404);
    return true;
  });
  assert.equal(calls.length, 0);
  await tvdb.list('hoat-hinh');
  await tvdb.list('hoat-hinh');
  // `hoat-hinh` phải đổi thành id số trước khi vào filter.
  assert.equal(param('/v4/series/filter', 'genre'), '2');
  assert.equal(asked('/v4/series/filter').length, 2, 'hai nước; lần gọi thứ hai ăn cache HTTP');
  // Bảng thể loại là bảng tra, không phải dữ liệu trang: tải lại mỗi lần mở danh
  // sách là mỗi trang thêm một request cho cùng một bảng không đổi.
  assert.equal(asked('/v4/genres').length, 1);
  await tvdb.byGenre('chinh-kich');
  assert.equal(param('/v4/series/filter', 'genre', 2), '7');
  assert.equal(asked('/v4/genres').length, 1, 'byGenre dùng lại bảng đã tải');
  // Thể loại không kèm `slug` thì slug tự sinh từ tên, và taxonomy xếp theo tên.
  const taxonomy = await tvdb.genres();
  assert.deepEqual(taxonomy.items.map((item) => item.slug), ['animation', 'chinh-kich']);
  assert.deepEqual(taxonomy.items.map((item) => item.id), ['2', '7']);
});

test('nhiều nước: gộp thành một trang và bỏ phim trùng', async () => {
  // Filter của TVDB chỉ nhận một nước mỗi lần, nên adapter hỏi song song rồi gộp.
  const perCountry = (url) => ({
    data: url.searchParams.get('country') === 'chn'
      ? [seriesItem(1, 'Diên Hy Công Lược'), seriesItem(2, 'Trường Ca Hành')]
      : [seriesItem(2, 'Trường Ca Hành'), seriesItem(3, 'Hậu Duệ Mặt Trời')],
    links: {}
  });
  stub({ '/v4/series/filter': perCountry });
  const found = await tvdb.home({ page: 1 });
  assert.equal(asked('/v4/series/filter').length, 2, 'một request cho mỗi nước');
  // Phim đồng sản xuất nằm ở cả hai nước: gộp theo slug, không hiện hai thẻ giống nhau.
  assert.deepEqual(found.items.map((item) => item.slug), [
    'dien-hy-cong-luoc-v1s', 'truong-ca-hanh-v2s', 'hau-due-mat-troi-v3s'
  ]);
  assert.equal(found.pagination.currentPage, 1);
});

test('một nước lỗi vẫn còn nội dung; mọi nước lỗi mới là lỗi nguồn', async () => {
  stub(
    { '/v4/series/filter': { data: [seriesItem(5, 'Tam Sinh Tam Thế')], links: {} } },
    { '/v4/series/filter': [502] }
  );
  const found = await tvdb.home({ page: 1 });
  assert.equal(asked('/v4/series/filter').length, 2);
  // Một nước hỏng mà cả trang trống thì người xem thấy "không có phim" vì một lý do
  // chẳng liên quan gì đến phim họ muốn xem.
  assert.equal(found.items.length, 1);

  stub({ '/v4/series/filter': { data: [], links: {} } }, { '/v4/series/filter': [502, 502] });
  await assert.rejects(() => tvdb.home({ page: 1 }), (error) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /HTTP 502/);
    return true;
  });
});



