/**
 * Mô hình thư viện trên máy: gộp tiến trình theo **phim**, tách "đang xem"/"đã
 * xem", và chịu được dữ liệu hỏng trong localStorage.
 *
 * Vì sao phải có test: đây là chỗ sửa của lỗi "mỗi tập một dòng" — `watch_progress`
 * có khoá theo tập nên một series 10 tập là 10 bản ghi, và nếu phép gộp sai thì
 * thư viện lại quay về hiện danh sách tập. Ngoài ra bản ghi còn đến từ hai nguồn
 * (API và máy) với mốc thời gian khác nhau, không có lỗi nào hiện ra ở đâu cả.
 *
 * `src/library.ts` cố ý không import gì chạy được nên biên dịch được một file duy
 * nhất, không cần bundler (xem chú thích trong file đó).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const library = (() => {
  const ts = createRequire(import.meta.url)('typescript');
  const js = ts.transpileModule(readFileSync(resolve(app, 'src/library.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const box = { exports: {} };
  new Function('exports', 'module', js)(box.exports, box);
  return box.exports;
})();

const {
  addFavorite, addProgress, continueItems, dropFavorite, emptyLibrary, episodeLabel,
  mergeFavorites, parseLibrary, progressPercent, progressKey, serializeLibrary,
  FAVORITE_LIMIT, PROGRESS_LIMIT, CONTINUE_LIMIT
} = library;

const movie = (slug, over = {}) => ({
  id: 0, provider: 'vsmov', providerId: null, slug, name: `Phim ${slug}`, originName: null,
  description: null, type: 'series', status: null, year: 2024, duration: null, quality: 'FHD',
  language: 'Vietsub', posterUrl: `https://x/${slug}.jpg`, thumbUrl: `https://x/${slug}-thumb.jpg`,
  trailerUrl: null, rating: 8, viewCount: 0, tmdbId: null, imdbId: null,
  genres: [], countries: [], actors: [], directors: [], ...over
});

const progress = (slug, episodeId, over = {}) => ({
  movie: movie(slug), episodeId, episodeName: String(episodeId),
  position: 10, duration: 100, completed: false, updatedAt: 1000, ...over
});

test('đọc localStorage: JSON hỏng hoặc rỗng đều coi như thư viện trống', () => {
  assert.deepEqual(parseLibrary(null), emptyLibrary());
  assert.deepEqual(parseLibrary('{'), emptyLibrary());
  assert.deepEqual(parseLibrary('{"favorites":null,"progress":null}'), emptyLibrary());
  // Bản ghi thiếu slug hoặc episodeId không dựng lại được thì bỏ, không ném lỗi.
  const messy = JSON.stringify({ favorites: { a: { movie: { name: 'x' } } }, progress: { k: { movie: movie('a'), episodeId: 'x' } } });
  assert.deepEqual(parseLibrary(messy), emptyLibrary());
});

test('lưu và bỏ phim: ghi được, xoá được, giữ nguyên state cũ khi bỏ phim lạ', () => {
  const saved = addFavorite(emptyLibrary(), movie('phim-a'));
  assert.equal(Object.keys(saved.favorites).length, 1);
  assert.equal(saved.favorites['phim-a'].movie.slug, 'phim-a');
  assert.equal(dropFavorite(saved, 'phim-a').favorites['phim-a'], undefined);
  const untouched = dropFavorite(saved, 'khong-co');
  assert.equal(untouched, saved, 'bỏ phim không có thì trả lại đúng state cũ');
  const roundTrip = parseLibrary(serializeLibrary(saved));
  assert.deepEqual(roundTrip, saved);
});

test('phim đã lưu: quá trần thì bỏ bản cũ nhất, phim mới vẫn còn', () => {
  let state = emptyLibrary();
  for (let index = 0; index < FAVORITE_LIMIT + 5; index++) {
    state = addFavorite(state, movie(`phim-${index}`), 1000 + index);
  }
  assert.equal(Object.keys(state.favorites).length, FAVORITE_LIMIT);
  assert.equal(state.favorites['phim-0'], undefined, 'phim lưu sớm nhất bị bỏ');
  assert.ok(state.favorites[`phim-${FAVORITE_LIMIT + 4}`], 'phim vừa lưu vẫn còn');
});

test('tiến trình: cùng tập ghi lại thì đè, quá trần thì bỏ bản cũ nhất', () => {
  let state = addProgress(emptyLibrary(), progress('phim-a', 1, { updatedAt: 100 }));
  state = addProgress(state, progress('phim-a', 1, { position: 50, updatedAt: 200 }));
  assert.equal(Object.keys(state.progress).length, 1);
  assert.equal(state.progress[progressKey('phim-a', 1)].position, 50);
  for (let index = 0; index < PROGRESS_LIMIT + 20; index++) {
    state = addProgress(state, progress('phim-a', 1000 + index, { updatedAt: 1000 + index }));
  }
  assert.equal(Object.keys(state.progress).length, PROGRESS_LIMIT);
  assert.equal(state.progress[progressKey('phim-a', 1000)], undefined, 'bản cũ nhất bị bỏ');
});

test('thư viện phim đã lưu: gộp API + máy, mỗi slug một lần, bản API đứng trước', () => {
  const remote = [movie('phim-a', { id: 7 }), movie('phim-b')];
  const local = [
    { movie: movie('phim-a'), savedAt: 2 },
    { movie: movie('phim-c'), savedAt: 1 }
  ];
  const merged = mergeFavorites(remote, local);
  assert.deepEqual(merged.map((item) => item.slug), ['phim-a', 'phim-b', 'phim-c']);
  assert.equal(merged[0].id, 7, 'bản của API mới hơn bản chụp trên máy');
});

test('một series nhiều tập: gộp thành MỘT dòng, giữ tập mới nhất', () => {
  const local = [1, 2, 3].map((episodeId) => progress('phim-a', episodeId, { updatedAt: 1000 + episodeId * 100, episodeName: `Tập ${episodeId}` }));
  const { watching, watched } = continueItems([], local);
  assert.equal(watching.length, 1, 'không hiện một dòng cho mỗi tập');
  assert.equal(watching[0].episodeId, 3);
  assert.equal(watching[0].episodeName, 'Tập 3');
  assert.equal(watched.length, 0);
});

test('tiến trình của API và của máy: bản mới hơn thắng theo từng phim', () => {
  const remote = [
    { episode_id: 11, position_seconds: 30, duration_seconds: 100, updated_at: '2026-09-30T10:00:00.000Z', slug: 'phim-a', name: 'Phim A', thumbUrl: null, episodeName: 'Tập 11' },
    { episode_id: 21, updated_at: '2026-09-30T09:00:00.000Z', slug: 'phim-b', name: 'Phim B', episodeName: 'Full' }
  ];
  const local = [
    progress('phim-a', 12, { updatedAt: Date.parse('2026-09-30T11:00:00.000Z'), episodeName: 'Tập 12' })
  ];
  const { watching } = continueItems(remote, local);
  assert.equal(watching.length, 2);
  assert.deepEqual(watching.map((item) => item.slug), ['phim-a', 'phim-b']);
  assert.equal(watching[0].episodeId, 12, 'bản trên máy mới hơn');
  assert.equal(watching[1].name, 'Phim B');
  assert.equal(watching[1].duration, 0, 'API thiếu thời lượng thì coi như 0');
});

test('tập đã xem xong tách sang mục "Đã xem" chứ không nằm ở "Xem tiếp"', () => {
  const local = [
    progress('phim-a', 1, { completed: true, updatedAt: 2000 }),
    progress('phim-b', 1, { completed: false, updatedAt: 1500 })
  ];
  const { watching, watched } = continueItems([], local);
  assert.deepEqual(watching.map((item) => item.slug), ['phim-b']);
  assert.deepEqual(watched.map((item) => item.slug), ['phim-a']);
});

test('dải xem tiếp có trần, sắp theo lần xem gần nhất', () => {
  const local = Array.from({ length: CONTINUE_LIMIT + 5 }, (_, index) =>
    progress(`phim-${index}`, 1, { updatedAt: 1000 + index }));
  const { watching } = continueItems([], local);
  assert.equal(watching.length, CONTINUE_LIMIT);
  assert.equal(watching[0].slug, `phim-${CONTINUE_LIMIT + 4}`);
});

test('nhãn tập: "3" thành "Tập 3", "Full"/"Tập 3" giữ nguyên', () => {
  assert.equal(episodeLabel('3'), 'Tập 3');
  assert.equal(episodeLabel('Full'), 'Full');
  assert.equal(episodeLabel('Tập 3'), 'Tập 3');
  assert.equal(episodeLabel(''), '');
  assert.equal(progressPercent({ position: 25, duration: 100 }), 25);
  assert.equal(progressPercent({ position: 30, duration: 0 }), 0);
  assert.equal(progressPercent({ position: 300, duration: 100 }), 100);
});
