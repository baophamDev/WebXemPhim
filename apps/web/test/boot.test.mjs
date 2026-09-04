/**
 * Hai nửa của phép so khớp request bắn trước có còn gặp nhau không.
 *
 * Nửa thứ nhất là khối `<script>` cổ điển trong `index.html`: nó nối URL bằng tay
 * lúc trình duyệt còn đang đọc HTML. Nửa thứ hai là `bootUrl()` trong `src/boot.ts`,
 * chạy trong bundle khi RTK Query hỏi cùng endpoint đó. Lệch một ký tự là không nhặt
 * được, trang lại chờ trọn một round-trip — **và không có lỗi nào hiện ra**. Đó là
 * lý do phần này phải có test: nó là loại hỏng mà chạy thử bằng mắt không thấy.
 *
 * Một điểm phải làm cho đúng: phép thay `%VITE_API_URL%` của Vite là **regex
 * global** trên toàn bộ file HTML. Bản harness đầu tiên của test này thay bằng chuỗi
 * thường (chỉ trúng chỗ đầu tiên) nên nó trúng vào comment và báo sai — nhưng đúng
 * lúc đó mới thấy Vite cũng thay cả trong comment, tức là trang đã build sẽ có một
 * URL nằm giữa câu tiếng Việt. Comment trong `index.html` đã viết lại cho khỏi vậy,
 * và test dưới đây khoá luôn: mô phỏng đúng regex global, cộng một assert là token
 * chỉ được xuất hiện một lần.
 *
 * Cách chạy khối script: `new Function` với `window`/`location`/`localStorage`/`fetch`
 * giả. Không cần jsdom — script này cố ý chỉ dùng đúng bốn thứ đó.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(resolve(app, file), 'utf8');

/** Giá trị bất kỳ, chỉ cần API khác origin của web — đúng như deploy thật. */
const API = 'https://api.example.test/api';
const ORIGIN = 'https://cinema.example.test';

// `shape()` trong boot.ts đọc `location.origin` để giải URL tương đối, và
// `claimBoot` đọc `window.__BOOT__`. Đặt trước khi nạp module.
globalThis.window = {};
globalThis.location = { origin: ORIGIN, pathname: '/', search: '' };

/**
 * `src/boot.ts` thật, biên dịch tại chỗ bằng chính bản TypeScript của repo.
 *
 * Không import bản đã build vì `apps/web` không phát ra JS (`tsc -b` chỉ kiểm kiểu,
 * việc dựng là của vite). Transpile một file không có import nào thì rẻ và không cần
 * bundler — đổi lại là không kiểm kiểu ở đây, nhưng `npm run typecheck` đã lo phần đó.
 */
const boot = (() => {
  const ts = createRequire(import.meta.url)('typescript');
  const js = ts.transpileModule(read('src/boot.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const box = { exports: {} };
  new Function('exports', 'module', js)(box.exports, box);
  return box.exports;
})();

const html = read('index.html');

/**
 * Khối script bắn trước request, lấy ra từ `index.html`.
 *
 * Nhận ra nó bằng `__BOOT__` chứ không bằng thứ tự: trong `index.html` còn một khối
 * `<script>` nội tuyến nữa (lớp điều khiển TV ở cuối `<body>`), và thứ tự hai khối
 * đó không phải là thứ test này được phép phụ thuộc vào.
 */
function bootScript() {
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const found = inline.filter((body) => body.includes('__BOOT__'));
  assert.equal(found.length, 1, 'index.html phải có đúng một khối script nội tuyến bắn trước request');
  return found[0];
}

/**
 * Chạy khối script như trình duyệt chạy nó, trả về hàng đợi nó dựng được.
 *
 * `base` để trống nghĩa là giả cảnh chưa đặt VITE_API_URL: Vite giữ nguyên chuỗi
 * `%…%` và script phải tự nhận ra rồi lùi về `/api`.
 */
function runBoot(pathname, { base = API, saved = null } = {}) {
  // Thay biến bằng regex **global** trên toàn bộ nguồn, y hệt hook của Vite. Thay
  // bằng chuỗi thường chỉ trúng chỗ đầu tiên, nên nếu comment nhắc tới token thì
  // `var base` không được thay và test báo hỏng ở chỗ code hoàn toàn đúng.
  const code = bootScript().replace(/%VITE_API_URL%/g, base);
  const window = {};
  const sent = [];
  const scope = {
    window,
    location: { pathname, search: '', origin: ORIGIN },
    localStorage: { getItem: () => saved },
    fetch: (url) => {
      sent.push(url);
      return Promise.resolve({ status: 200, ok: true, text: () => Promise.resolve('{"ok":true}') });
    }
  };
  new Function(...Object.keys(scope), code)(...Object.values(scope));
  return { queue: window.__BOOT__ ?? [], sent };
}

/** Gắn hàng đợi vào `window` rồi hỏi `claimBoot` đúng như baseQuery của api.ts hỏi. */
function claim(queue, args, base = API) {
  globalThis.window.__BOOT__ = queue;
  return boot.claimBoot(boot.bootUrl(base, args));
}

test('%VITE_API_URL% chỉ được xuất hiện một lần trong khối script', () => {
  // Hook của Vite thay mọi chỗ khớp, kể cả trong comment. Xuất hiện lần thứ hai
  // nghĩa là trang đã build có một URL nằm ở chỗ không ai chờ nó — vô hại lúc chạy,
  // nhưng nó xoá mất dấu hiệu "chỉ có một chỗ duy nhất đọc biến này".
  const hits = bootScript().match(/%VITE_API_URL%/g) ?? [];
  assert.equal(hits.length, 1, 'nhắc tên biến trong comment thì viết trần, không kẹp dấu %');
});

test('trang chủ: bắn đúng một request và RTK Query nhặt lại được', () => {
  const { queue, sent } = runBoot('/');
  assert.equal(queue.length, 1);
  assert.equal(sent[0], `${API}/catalog/home?page=1&limit=24`);
  assert.ok(claim(queue, { url: '/catalog/home', params: { page: 1, limit: 24 } }), 'phải khớp');
});

test('trang chủ: page/limit trong index.html khớp Home.tsx', () => {
  // Đây là chỗ coupling im lặng nhất trong cả cơ chế: đổi limit ở một bên thì URL
  // khác đi, không nhặt được, trang chủ chờ lại như cũ mà không báo gì.
  const call = /useGetCatalogQuery\(\{\s*kind:\s*'home',\s*page:\s*(\d+),\s*limit:\s*(\d+)\s*\}\)/
    .exec(read('src/pages/Home.tsx'));
  assert.ok(call, 'không tìm thấy lời gọi dải đầu trong Home.tsx — sửa test này cho khớp code');
  const { queue } = runBoot('/');
  assert.ok(
    claim(queue, { url: '/catalog/home', params: { page: Number(call[1]), limit: Number(call[2]) } }),
    `index.html bắn page/limit khác Home.tsx (${call[1]}/${call[2]})`
  );
});

test('/index.html cũng tính là trang chủ', () => {
  assert.equal(runBoot('/index.html').queue.length, 1);
});

test('trang phim: khớp getMovie(slug)', () => {
  const { queue, sent } = runBoot('/movie/tay-du-ky-2025');
  assert.equal(sent[0], `${API}/catalog/movies/tay-du-ky-2025`);
  assert.ok(claim(queue, '/catalog/movies/tay-du-ky-2025'));
});

test('trang xem: bắn tập TRƯỚC phim, và nhặt lại được cả hai', () => {
  const { queue, sent } = runBoot('/watch/tay-du-ky-2025/4210');
  // Thứ tự là thứ tự cần: một dòng episode đủ để bấm play, còn /catalog/movies/:slug
  // phải join phim + tập + người mới dựng được tiêu đề và danh sách tập.
  assert.deepEqual(sent, [`${API}/episodes/4210`, `${API}/catalog/movies/tay-du-ky-2025`]);
  assert.ok(claim(queue, '/episodes/4210'), 'getEpisode(id) phải khớp');
  assert.ok(claim(queue, '/catalog/movies/tay-du-ky-2025'), 'getMovie(slug) phải khớp');
});

test('đã chọn nguồn: cả hai bên đều gắn ?source=, trừ /episodes', () => {
  const { queue, sent } = runBoot('/watch/tay-du-ky-2025/4210', { saved: '  VsMov  ' });
  // `/episodes` không khớp NEEDS_SOURCE trong api.ts nên baseQuery không gắn source;
  // script cũng cố ý không bọc withSource() cho nó.
  assert.deepEqual(sent, [`${API}/episodes/4210`, `${API}/catalog/movies/tay-du-ky-2025?source=vsmov`]);
  assert.ok(claim(queue, '/episodes/4210'));
  assert.ok(claim(queue, { url: '/catalog/movies/tay-du-ky-2025', params: { source: 'vsmov' } }));
});

test("nguồn 'auto' thì không gắn tham số nào", () => {
  const { sent } = runBoot('/', { saved: 'AUTO' });
  assert.equal(sent[0], `${API}/catalog/home?page=1&limit=24`);
});

test('thứ tự tham số khác nhau vẫn là cùng một request', () => {
  const { queue } = runBoot('/', { saved: 'vsmov' });
  // Script nối source vào cuối; api.ts xếp từ object nên source có thể ra trước.
  assert.ok(claim(queue, { url: '/catalog/home', params: { source: 'vsmov', limit: 24, page: 1 } }));
});

test('VITE_API_URL chưa đặt: cả hai bên lùi về /api', () => {
  const { queue, sent } = runBoot('/', { base: '%VITE_API_URL%' });
  assert.equal(sent[0], '/api/catalog/home?page=1&limit=24');
  assert.ok(claim(queue, { url: '/catalog/home', params: { page: 1, limit: 24 } }, '/api'));
});

test('VITE_API_URL có dấu / lặp ở cuối vẫn khớp', () => {
  // Script cắt hết dấu `/` cuối, api.ts cắt đúng một dấu — nên một bên ra
  // `/api//catalog`. Cùng endpoint với Express, khác chuỗi; `shape()` phải gộp lại.
  const { queue } = runBoot('/', { base: `${API}//` });
  assert.ok(claim(queue, { url: '/catalog/home', params: { page: 1, limit: 24 } }, `${API}/`));
});

test('route không có trong danh sách thì không bắn gì', () => {
  for (const path of ['/tim-kiem', '/the-loai/hanh-dong', '/watch/phim/khong-phai-so', '/movie/a/b']) {
    assert.equal(runBoot(path).queue.length, 0, path);
  }
});

test('nhặt một lần: lần thứ hai phải tự đi hỏi lại', () => {
  const { queue } = runBoot('/');
  const args = { url: '/catalog/home', params: { page: 1, limit: 24 } };
  assert.ok(claim(queue, args));
  // Giữ lại thì một cú refetch() nhận đúng dữ liệu cũ, và người dùng bấm "thử lại"
  // mãi vẫn thấy y nguyên.
  assert.equal(claim(queue, args), null);
});

test('quá 30 giây thì thà hỏi lại', () => {
  const { queue } = runBoot('/');
  queue[0].at -= 31_000;
  assert.equal(claim(queue, { url: '/catalog/home', params: { page: 1, limit: 24 } }), null);
});

test('URL không khớp thì bỏ qua, và request đó vẫn còn nguyên trong hàng', () => {
  const { queue } = runBoot('/');
  assert.equal(claim(queue, { url: '/catalog/home', params: { page: 2, limit: 24 } }), null);
  assert.equal(queue.length, 1, 'không được lấy mất request của endpoint khác');
});

test('không có gì bắn trước thì claimBoot trả null, không ném', () => {
  globalThis.window.__BOOT__ = undefined;
  assert.equal(boot.claimBoot(boot.bootUrl(API, '/catalog/home')), null);
  globalThis.window.__BOOT__ = [];
  assert.equal(boot.claimBoot(boot.bootUrl(API, '/catalog/home')), null);
});

test('bootUrl: bỏ tham số undefined, giữ tham số rỗng', () => {
  // RTK Query để `undefined` cho tham số không truyền; `fetchBaseQuery` bỏ chúng,
  // nên bên này cũng phải bỏ, không thì URL có `&type=undefined`.
  assert.equal(boot.bootUrl(API, { url: '/catalog/home', params: { page: 1, type: undefined } }), `${API}/catalog/home?page=1`);
  assert.equal(boot.bootUrl(API, { url: '/catalog/home', params: {} }), `${API}/catalog/home`);
  assert.equal(boot.bootUrl(API, '/health'), `${API}/health`);
  assert.equal(boot.bootUrl(API, { url: '/catalog/search?q=a', params: { page: 2 } }), `${API}/catalog/search?q=a&page=2`);
});
