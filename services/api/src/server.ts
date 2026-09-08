import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import {
  closeDatabase, getContinue, getEpisodes, getMovie, getPerson, getSyncState, initDatabase, isFavorite,
  listCountriesFromDb, listFavorites, listGenresFromDb, listMovies, listPeople, listYearsFromDb,
  saveProgress, toggleFavorite, updatePeopleThumbs, upsertEpisodes, upsertMovie
} from './db.js';
import { describeFailure, shortCause } from './errors.js';
import { asyncRoute, serverCachedRoute } from './http.js';
import { cacheInvalidate, routeKey } from './cache.js';
import { forgetImport, importJob, importQueueSize, startImport, waitForImport, type ImportJob, type Report } from './importer.js';
import { catalog, type CatalogFilters } from './providers/index.js';
import { slugifyName } from './text.js';
import { syncLatest } from './sync.js';

const app = express();
/**
 * Origin được phép gọi API. Ngoài danh sách cố định trong `WEB_ORIGIN`, cho phép
 * luôn mọi domain `*.vercel.app` (bản production và các preview deployment sinh
 * URL mới mỗi lần push) — nếu không, web trên Vercel bị CORS chặn và giao diện
 * hiện "API ngoại tuyến" dù API vẫn sống.
 *
 * App trên TV LG là hosted web app (appinfo.json trỏ `main` vào URL Vercel) nên nó
 * đi qua đúng nhánh `*.vercel.app` ở trên. Nhánh `origin === 'null'` giữ lại cho
 * đường lùi packaged — bản đó nạp index.html bằng file://, origin là opaque nên
 * trình duyệt gửi đúng chuỗi `Origin: null` và không cho qua thì TV hiện "API
 * ngoại tuyến". Nhánh `!origin` ngay dưới đã nhận mọi client không phải trình
 * duyệt (curl, app native...) nên thêm 'null' không nới thêm quyền gì đáng kể;
 * vẫn để cờ `ALLOW_NULL_ORIGIN=false` cho ai muốn tắt.
 */
const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
const allowVercelPreview = process.env.ALLOW_VERCEL_PREVIEW !== 'false';
const allowNullOrigin = process.env.ALLOW_NULL_ORIGIN !== 'false';
function isAllowedOrigin(origin: string) {
  if (allowedOrigins.includes(origin)) return true;
  if (origin === 'null') return allowNullOrigin;
  if (!allowVercelPreview) return false;
  try { return new URL(origin).hostname.endsWith('.vercel.app'); } catch { return false; }
}
app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error('Origin is not allowed'));
  }
}));
app.use(express.json({ limit: '1mb' }));

const filtersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(48).default(24),
  year: z.string().trim().optional(), country: z.string().trim().optional(), category: z.string().trim().optional(),
  type: z.enum(['single', 'series', 'hoathinh', 'tvshows']).optional(), status: z.enum(['trailer', 'ongoing', 'completed']).optional()
});
const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._-]+$/);
const idSchema = z.coerce.number().int().positive();
const queryFilters = (query: express.Request['query']) => filtersSchema.parse(query) as CatalogFilters;

/**
 * Nhập một phim từ VSMOV vào DB.
 *
 * `report` để job ở nền kể lại việc đang làm. `catalog.detail()` báo chặng
 * `loading`, còn `saving` là chặng duy nhất thuộc về hàm này, và nó báo
 * *trước* khi ghi DB nên chặng hiện lên là chặng đang chờ.
 */
async function importDetail(slug: string, report?: Report) {
  const detail = await catalog.detail(slug, (stage, source) => report?.(stage, source));
  report?.('saving', detail.source);
  const movieId = await upsertMovie(detail.movie);
  await upsertEpisodes(movieId, detail.episodes);
  return getMovie(slug, true);
}

/**
 * Mở (hoặc gặp lại) job nhập phim ở nền cho `slug`. Không await: chỗ gọi trả lời
 * client ngay với trạng thái job, còn việc kéo dữ liệu tiếp tục chạy.
 */
function queueImport(slug: string): ImportJob {
  return startImport(slug, (report) => importDetail(slug, report));
}

/**
 * Trả lời cho một request "cho tôi phim này".
 *
 * Có trong DB thì trả luôn — đường phổ biến nhất và nhanh nhất. Chưa có thì
 * **không** chặn request để đi kéo về: mở job ở nền rồi trả 202 kèm chặng đang
 * chạy, web vẽ trang chi tiết từ dữ liệu thẻ phim vừa bấm và hiện tiến trình thật.
 * Đây là điểm đổi thứ tự ưu tiên: điều hướng trước, đồng bộ dữ liệu sau.
 *
 * `?wait=1` giữ lại hành vi chặn cũ cho curl, script nhập tay và client không
 * biết poll. Job đổ thì ném lại lỗi gốc (404 khác 502) và bỏ job đi, để lần thử
 * lại là một lần nhập thật chứ không phải phát lại lỗi cũ.
 */
async function respondWithMovie(req: express.Request, res: express.Response, slug: string) {
  const saved = await getMovie(slug, true);
  if (saved) return res.json({ movie: saved });

  const wait = req.query.wait === '1' || req.query.wait === 'true';
  const job = queueImport(slug);
  if (!wait) {
    if (job.stage !== 'failed') return res.status(202).json({ movie: null, importing: job });
    forgetImport(slug);
    return res.status(502).json({ message: job.error ?? `Không nhập được phim "${slug}"` });
  }
  try {
    await waitForImport(slug);
  } catch (error) {
    forgetImport(slug);
    throw error;
  }
  const movie = await getMovie(slug, true);
  if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim' });
  return res.json({ movie });
}

/**
 * VSMOV là nguồn duy nhất có ảnh diễn viên, nhưng gọi mỗi request thì chậm.
 * Ghép ảnh vào bảng people tối đa 1 lần/giờ, và lỗi nguồn thì bỏ qua im lặng
 * — thiếu ảnh không phải lý do để trang diễn viên trả lỗi.
 */
let thumbsSyncedAt = 0;
async function refreshPeopleThumbs() {
  if (Date.now() - thumbsSyncedAt < 3_600_000) return;
  thumbsSyncedAt = Date.now();
  try {
    const remote = await catalog.actors();
    const updated = await updatePeopleThumbs(remote.items.map((item) => ({ name: item.name, thumbUrl: item.thumbUrl })));
    if (updated) console.log(`Đã cập nhật ảnh cho ${updated} diễn viên`);
  } catch (error) {
    console.warn('Không lấy được ảnh diễn viên từ nguồn nào:', (error as Error).message);
  }
}

/**
 * Taxonomy ưu tiên VSMOV (có slug chuẩn để gọi tiếp), VSMOV chết thì
 * dựng từ DB để menu điều hướng không bao giờ trắng.
 */
async function taxonomyWithFallback(
  fromProvider: () => Promise<{ items: unknown[] }>,
  fromDb: () => Promise<readonly Record<string, any>[]>
) {
  try {
    const remote = await fromProvider();
    if (remote.items.length) return { source: 'vsmov', items: remote.items };
  } catch (error) {
    console.warn('VSMOV không trả lời taxonomy, chuyển sang DB:', (error as Error).message);
  }
  const rows = await fromDb();
  return {
    source: 'database',
    items: rows.map((row) => {
      const name = String(row.name ?? row.year ?? '');
      return { id: name, name, slug: row.year != null ? name : slugifyName(name), thumbUrl: null, count: row.count };
    })
  };
}

/**
 * Trạng thái kết nối DB, do initDatabaseWithRetry() ở cuối file cập nhật. `reason`
 * là lý do ngắn để hiện ở `/api/health` (endpoint công khai) — message đầy đủ chỉ
 * đi vào log, xem `errors.ts`.
 */
export const dbState = { ready: false, reason: null as string | null };

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'bao-nhan-cinema-api', sources: catalog.names, database: dbState.ready ? 'ready' : 'connecting', databaseError: dbState.reason, imports: importQueueSize(), time: new Date().toISOString() }));

/**
 * Danh sách phim và taxonomy đều là dữ liệu chung, không cá nhân hoá, và đổi vài
 * lần một giờ là nhiều. Hai lớp cache chồng nhau:
 * - Trình duyệt giữ lại một lúc (`Cache-Control`, xem `http.ts`).
 * - Server giữ bản dùng chung trong Redis (lùi về RAM): lần mở lại (F5, back,
 *   hay mở lại app trên TV) của *bất kỳ ai* cũng không phải chờ nguồn ngoài.
 *
 * Ba đường **không** có ở đây là cố ý: `/catalog/movies/:slug` có thể trả 202
 * "đang nhập" (cache lại là đóng băng đúng cái đang chạy), còn `/api/people*`
 * đọc bảng nhỏ nên vốn đã nhanh.
 */
const catalogKey = (prefix: string) => (req: express.Request) => routeKey(prefix, { ...req.query, ...req.params });
app.get('/api/catalog/home', serverCachedRoute(60, catalogKey('catalog:home'), (req) => catalog.home(queryFilters(req.query))));
app.get('/api/catalog/lists/:slug', serverCachedRoute(60, catalogKey('catalog:list'), (req) => catalog.listBySlug(slugSchema.parse(req.params.slug), queryFilters(req.query))));
app.get('/api/catalog/search', serverCachedRoute(30, catalogKey('catalog:search'), (req) => catalog.search(z.string().trim().min(2).max(100).parse(req.query.q), queryFilters(req.query))));
app.get('/api/catalog/genres', serverCachedRoute(600, catalogKey('catalog:genres'), () => taxonomyWithFallback(() => catalog.genres(), listGenresFromDb)));
app.get('/api/catalog/genres/:slug', serverCachedRoute(60, catalogKey('catalog:genre'), (req) => catalog.byGenre(slugSchema.parse(req.params.slug), queryFilters(req.query))));
app.get('/api/catalog/countries', serverCachedRoute(600, catalogKey('catalog:countries'), () => taxonomyWithFallback(() => catalog.countries(), listCountriesFromDb)));
app.get('/api/catalog/countries/:slug', serverCachedRoute(60, catalogKey('catalog:country'), (req) => catalog.byCountry(slugSchema.parse(req.params.slug), queryFilters(req.query))));
app.get('/api/catalog/years', serverCachedRoute(600, catalogKey('catalog:years'), () => taxonomyWithFallback(() => catalog.years(), listYearsFromDb)));
app.get('/api/catalog/years/:year', serverCachedRoute(60, catalogKey('catalog:year'), (req) => catalog.byYear(z.string().regex(/^\d{4}$/).parse(req.params.year), queryFilters(req.query))));

// Một request cho toàn bộ menu điều hướng, thay vì 3 request song song lúc mở trang.
app.get('/api/catalog/navigation', serverCachedRoute(600, catalogKey('catalog:navigation'), async () => {
  const [genres, countries, years] = await Promise.all([
    taxonomyWithFallback(() => catalog.genres(), listGenresFromDb),
    taxonomyWithFallback(() => catalog.countries(), listCountriesFromDb),
    taxonomyWithFallback(() => catalog.years(), listYearsFromDb)
  ]);
  return { genres: genres.items, countries: countries.items, years: years.items };
}));

app.get('/api/catalog/codes', serverCachedRoute(600, catalogKey('catalog:codes'), () => catalog.codes()));
app.get('/api/catalog/codes/:code', serverCachedRoute(60, catalogKey('catalog:code'), (req) => catalog.byCode(z.string().trim().min(1).max(80).parse(req.params.code), queryFilters(req.query))));
app.get('/api/catalog/movies/:slug', asyncRoute(async (req, res) => { await respondWithMovie(req, res, slugSchema.parse(req.params.slug)); }));

const moviesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  type: z.enum(['single', 'series', 'hoathinh', 'tvshows']).optional(),
  person: slugSchema.optional(),
  personKind: z.enum(['actor', 'director']).optional(),
  sort: z.enum(['recent', 'rating', 'year', 'name', 'views']).default('recent')
});

app.get('/api/movies', serverCachedRoute(60, catalogKey('movies'), async (req) => {
  const query = moviesQuerySchema.parse(req.query);
  return listMovies({ ...query, q: query.q || undefined });
}));

// Diễn viên & đạo diễn. `q` tìm không dấu: "tran thanh" ra "Trấn Thành".
app.get('/api/people', asyncRoute(async (req, res) => {
  const query = z.object({
    q: z.string().trim().max(80).optional(),
    kind: z.enum(['actor', 'director']).optional(),
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(120).default(60)
  }).parse(req.query);
  void refreshPeopleThumbs();
  res.json(await listPeople({ ...query, q: query.q || undefined }));
}));

app.get('/api/people/:slug', asyncRoute(async (req, res) => {
  const slug = slugSchema.parse(req.params.slug);
  const person = await getPerson(slug);
  if (!person) return res.status(404).json({ message: 'Không tìm thấy người này' });
  const filters = z.object({
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
    kind: z.enum(['actor', 'director']).optional()
  }).parse(req.query);
  const filmography = await listMovies({ person: slug, personKind: filters.kind, page: filters.page, limit: filters.limit, sort: 'year' });
  res.json({ person, ...filmography });
}));

// Giữ đường cũ cho frontend đang chạy; nội dung giờ lấy từ bảng people.
app.get('/api/catalog/actors', asyncRoute(async (req, res) => {
  void refreshPeopleThumbs();
  const limit = z.coerce.number().int().min(1).max(120).default(120).parse(req.query.limit ?? 120);
  res.json(await listPeople({ kind: 'actor', page: 1, limit }));
}));

/**
 * Tìm kiếm hợp nhất trên dữ liệu đã có trong DB: một từ khoá trả về cả phim
 * trùng tên và người trùng tên, để trang tìm kiếm gợi ý được "phim có diễn viên
 * X" mà không cần người dùng biết trước phải bấm vào đâu.
 */
app.get('/api/search', serverCachedRoute(30, catalogKey('search'), async (req) => {
  const query = z.object({
    q: z.string().trim().min(1).max(100),
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24)
  }).parse(req.query);
  const [movies, people] = await Promise.all([
    listMovies({ q: query.q, page: query.page, limit: query.limit, sort: 'recent' }),
    listPeople({ q: query.q, page: 1, limit: 8 })
  ]);
  return { query: query.q, movies, people: people.items };
}));

app.get('/api/movies/:slug', asyncRoute(async (req, res) => { await respondWithMovie(req, res, slugSchema.parse(req.params.slug)); }));
/**
 * Tiến trình của một lần nhập. Web poll đúng endpoint này chứ không poll lại
 * `/api/movies/:slug`: một lần đọc trạng thái trong RAM rẻ hơn nhiều so với một
 * lần join phim + tập + người, mà 1.5 giây/lần thì khác biệt đó thành thật.
 *
 * `stage: 'ready'` nghĩa là đã ghi xong DB, web gọi lại phim một lần nữa là có.
 * Không có job (`null`) nghĩa là chưa từng nhập hoặc job đã bị dọn — web coi như
 * không có gì đang chạy.
 */
app.get('/api/import/:slug/status', asyncRoute(async (req, res) => {
  const slug = slugSchema.parse(req.params.slug);
  const job = importJob(slug);
  if (job?.stage === 'failed') forgetImport(slug);
  res.json({ slug, importing: job });
}));
app.get('/api/episodes/:id', asyncRoute(async (req, res) => { const episode = await getEpisodes(idSchema.parse(req.params.id)); if (!episode) return res.status(404).json({ message: 'Không tìm thấy tập phim' }); res.json(episode); }));
app.get('/api/continue-watching', asyncRoute(async (req, res) => res.json({ items: await getContinue(String(req.query.deviceId ?? 'local-device')) })));
app.get('/api/favorites', asyncRoute(async (req, res) => res.json({ items: await listFavorites(String(req.query.deviceId ?? 'local-device')) })));
app.get('/api/favorites/:movieId', asyncRoute(async (req, res) => res.json({ favorite: await isFavorite(String(req.query.deviceId ?? 'local-device'), idSchema.parse(req.params.movieId)) })));
app.post('/api/favorites/:movieId', asyncRoute(async (req, res) => {
  const body = z.object({ deviceId: z.string().trim().min(1).max(120).default('local-device'), enabled: z.boolean() }).parse(req.body);
  await toggleFavorite(body.deviceId, idSchema.parse(req.params.movieId), body.enabled); res.json({ favorite: body.enabled });
}));
app.post('/api/watch-progress', asyncRoute(async (req, res) => {
  const body = z.object({ deviceId: z.string().trim().min(1).max(120).default('local-device'), episodeId: idSchema, position: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative(), completed: z.boolean().default(false) }).parse(req.body);
  if (!await saveProgress(body.deviceId, body.episodeId, body.position, body.duration, body.completed)) return res.status(404).json({ message: 'Không tìm thấy tập phim' });
  res.json({ ok: true });
}));
app.get('/api/sync/status', asyncRoute(async (_req, res) => res.json(await getSyncState())));
app.post('/api/sync/start', asyncRoute(async (req, res) => {
  const state = await getSyncState(); if ((state as any)?.status === 'running') return res.status(409).json(state);
  const pages = z.object({ pages: z.number().int().min(1).max(20).optional() }).parse(req.body ?? {});
  // Sync xong thì mở lại các ngăn catalog/movies để dải "Mới cập nhật" thấy phim mới ngay.
  void syncLatest(pages.pages)
    .then(() => cacheInvalidate('web:catalog:'))
    .then(() => cacheInvalidate('web:movies'))
    .catch((error) => console.error('Catalog sync failed:', error));
  res.status(202).json({ started: true });
}));
/**
 * Nhập lại một phim theo yêu cầu (nút "Làm mới nguồn"). Route này **có** chờ: người
 * bấm đang đứng đó đợi dữ liệu mới, và nút đã tự hiện "Đang tải".
 *
 * Vẫn đi qua hàng đợi thay vì gọi thẳng `importDetail` — nếu phim này đang có job
 * chạy ở nền thì bấm nút sẽ chờ đúng job đó, không mở thêm một chuỗi request thứ
 * hai tới nguồn ngoài cho cùng một phim.
 */
app.post('/api/import/:slug', asyncRoute(async (req, res) => {
  const slug = slugSchema.parse(req.params.slug);
  queueImport(slug);
  try {
    await waitForImport(slug);
  } finally {
    forgetImport(slug);
  }
  await cacheInvalidate('web:movies');
  res.json({ movie: await getMovie(slug, true) });
}));
// Tìm trực tiếp ở VSMOV, bỏ qua kho đã lưu.
app.get('/api/provider/search', asyncRoute(async (req, res) => res.json(await catalog.search(z.string().trim().min(2).parse(req.query.q), queryFilters(req.query)))));

/**
 * Chỉ chỗ này quyết định client đọc được gì; luật nằm ở `errors.ts`. `ref` là sợi
 * dây nối response với dòng log tương ứng — người dùng đọc được mã ngắn, còn chi
 * tiết (host, cổng, tên bảng, stack) chỉ nằm trong log Railway.
 */
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const failure = describeFailure(error, { dbReady: dbState.ready });
  if (!failure.log) return res.status(failure.status).json({ message: failure.message });
  const ref = crypto.randomBytes(4).toString('hex');
  console.error(`[api ${ref}] ${req.method} ${req.originalUrl} -> ${failure.status}`, error);
  res.status(failure.status).json({ message: failure.message, ref });
});

const port = Number(process.env.PORT ?? 4000); const host = process.env.HOST ?? '0.0.0.0';

/**
 * Trước đây `start()` chờ `initDatabase()` xong mới `listen()`. Supabase free tier
 * tự ngủ sau vài ngày không dùng, nên một lần DNS/kết nối lỗi là API không mở cổng,
 * healthcheck `/api/health` của Railway fail và toàn bộ web hiện "API ngoại tuyến".
 * Giờ mở cổng trước rồi migrate ở nền, tự retry — API sống lại ngay khi DB tỉnh.
 */
async function initDatabaseWithRetry(attempt = 1): Promise<void> {
  try {
    await initDatabase();
    dbState.ready = true; dbState.reason = null;
    console.log('Database ready');
  } catch (error) {
    dbState.ready = false; dbState.reason = shortCause(error);
    const delay = Math.min(30_000, 2_000 * 2 ** (attempt - 1));
    console.error(`Database init failed (lần ${attempt}), thử lại sau ${delay}ms:`, (error as Error).message);
    setTimeout(() => void initDatabaseWithRetry(attempt + 1), delay).unref();
  }
}

app.listen(port, host, () => {
  console.log(`BaoNhanCinema API listening on http://${host}:${port}`);
  void initDatabaseWithRetry();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void closeDatabase().finally(() => process.exit(0)));
