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
import { asyncRoute, cachedRoute } from './http.js';
import { forgetImport, importJob, importQueueSize, startImport, waitForImport, type ImportJob, type Report } from './importer.js';
import { catalog, inactiveSources, type CatalogFilters } from './providers/index.js';
import { streamRouter } from './stream.js';
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

const sourceNameSchema = z.string().trim().max(40).regex(/^[A-Za-z0-9_-]+$/, 'tên nguồn chỉ gồm chữ, số, - và _');

/**
 * Nguồn ưu tiên cho **request này**, không phải cho cả tiến trình.
 *
 * Đọc từ `?source=` (web gửi kiểu này) hoặc header `x-catalog-source` (tiện cho
 * curl khi soi lỗi). Query param là đường chính có lý do: web ở Vercel gọi API ở
 * Railway là cross-origin, mà header lạ thì mọi GET catalog đều phải preflight
 * thêm một round-trip — đổi nguồn không đáng giá gấp đôi số request.
 *
 * `auto` hoặc không truyền gì thì dùng đúng thứ tự `CATALOG_SOURCES`. Tên không có
 * trong danh sách nguồn đang bật thì `prefer()` ném 400 — im lặng bỏ qua sẽ khiến
 * người dùng tưởng đã đổi nguồn trong khi vẫn đang xem nguồn cũ.
 *
 * `filtersSchema` bỏ khoá lạ nên `?source=` không lọt vào filter của nguồn.
 */
function preferredCatalog(req: express.Request) {
  const raw = (typeof req.query.source === 'string' ? req.query.source : '') || req.get('x-catalog-source') || '';
  const wanted = raw.trim();
  if (!wanted || wanted.toLowerCase() === 'auto') return catalog;
  return catalog.prefer(sourceNameSchema.parse(wanted));
}

/**
 * Nhập một phim từ các nguồn vào DB. Resolver ghép nguồn phát với nguồn metadata
 * (xem `providers/resolver.ts`), nên bản ghi lưu xuống đã đầy đủ nhất có thể ở
 * thời điểm nhập, không phải chờ lần sửa tay nào.
 *
 * `resolver` truyền vào để tôn trọng nguồn người dùng đang chọn: đứng ở catalog
 * TVDB bấm vào một phim thì phim đó nên được hỏi TVDB trước. Thứ tự "nguồn phát
 * trước" bên trong `detail()` vẫn giữ nguyên, nên chọn nguồn metadata không làm
 * mất nút play.
 * `report` để job ở nền kể lại việc đang làm. `resolver.detail()` nhận đúng kiểu
 * này vì `DetailStage` là tập con của `ImportStage`; `saving` là chặng duy nhất
 * thuộc về hàm này, và nó báo *trước* khi ghi DB nên chặng hiện lên là chặng đang
 * chờ.
 */
async function importDetail(slug: string, resolver = catalog, report?: Report) {
  const detail = await resolver.detail(slug, report);
  report?.('saving', detail.source);
  const movieId = await upsertMovie(detail.movie);
  await upsertEpisodes(movieId, detail.episodes);
  return getMovie(slug, true);
}

/**
 * Mở (hoặc gặp lại) job nhập phim ở nền cho `slug`. Không await: chỗ gọi trả lời
 * client ngay với trạng thái job, còn việc kéo dữ liệu tiếp tục chạy.
 */
function queueImport(slug: string, resolver = catalog): ImportJob {
  return startImport(slug, (report) => importDetail(slug, resolver, report));
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
  const job = queueImport(slug, preferredCatalog(req));
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
 * Provider là nguồn duy nhất có ảnh diễn viên, nhưng gọi mỗi request thì chậm.
 * Ghép ảnh vào bảng people tối đa 1 lần/giờ, và lỗi provider thì bỏ qua im lặng
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
 * Taxonomy ưu tiên nguồn ngoài (có slug chuẩn để gọi tiếp), mọi nguồn chết thì
 * dựng từ DB để menu điều hướng không bao giờ trắng.
 */
async function taxonomyWithFallback(
  fromProvider: () => Promise<{ items: unknown[] }>,
  fromDb: () => Promise<readonly Record<string, any>[]>
) {
  try {
    const remote = await fromProvider();
    if (remote.items.length) return { source: 'provider', items: remote.items };
  } catch (error) {
    console.warn('Taxonomy không có nguồn nào trả lời, chuyển sang DB:', (error as Error).message);
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
 * Trạng thái từng nguồn: nguồn nào đang bị circuit breaker tạm ngừng, lỗi cuối là
 * gì, làm được những gì. Khi web thiếu poster hay danh sách trống, đây là chỗ đầu
 * tiên cần xem — trước khi đi đọc log.
 *
 * `inactive` là các nguồn có tên nhưng chưa dùng được (thiếu khoá, chưa có
 * adapter). Bộ chọn nguồn ở web hiện chúng mờ kèm `hint` thay vì giấu đi.
 */
app.get('/api/providers', (_req, res) => res.json({
  sources: catalog.status(),
  inactive: inactiveSources(),
  order: catalog.names
}));

/**
 * Danh sách phim và taxonomy đều là dữ liệu chung, không cá nhân hoá, và đổi vài
 * lần một giờ là nhiều. Cho trình duyệt giữ lại một lúc: lần mở lại (F5, back,
 * hay mở lại app trên TV) không phải chờ nguồn ngoài trả lời lần nữa.
 *
 * Danh mục (thể loại/quốc gia/năm/code) đổi cực chậm nên giữ 10 phút; danh sách
 * phim 1 phút để "vừa thêm vào kho" không bị cũ tới mức nhìn ra được; tìm kiếm 30
 * giây, đủ cho cú bấm back mà không ai kịp thấy kết quả lạc hậu.
 *
 * Ba đường **không** có ở đây là cố ý: `/catalog/movies/:slug` có thể trả 202
 * "đang nhập" (cache lại là đóng băng đúng cái đang chạy), còn `/api/movies` với
 * `/api/search` đọc DB của mình nên vốn đã nhanh.
 */
app.get('/api/catalog/home', cachedRoute(60, (req) => preferredCatalog(req).home(queryFilters(req.query))));
app.get('/api/catalog/lists/:slug', cachedRoute(60, (req) => preferredCatalog(req).listBySlug(slugSchema.parse(req.params.slug), queryFilters(req.query))));
app.get('/api/catalog/search', cachedRoute(30, (req) => preferredCatalog(req).search(z.string().trim().min(2).max(100).parse(req.query.q), queryFilters(req.query))));
app.get('/api/catalog/genres', cachedRoute(600, (req) => taxonomyWithFallback(() => preferredCatalog(req).genres(), listGenresFromDb)));
app.get('/api/catalog/genres/:slug', cachedRoute(60, (req) => preferredCatalog(req).byGenre(slugSchema.parse(req.params.slug), queryFilters(req.query))));
app.get('/api/catalog/countries', cachedRoute(600, (req) => taxonomyWithFallback(() => preferredCatalog(req).countries(), listCountriesFromDb)));
app.get('/api/catalog/countries/:slug', cachedRoute(60, (req) => preferredCatalog(req).byCountry(slugSchema.parse(req.params.slug), queryFilters(req.query))));
app.get('/api/catalog/years', cachedRoute(600, (req) => taxonomyWithFallback(() => preferredCatalog(req).years(), listYearsFromDb)));
app.get('/api/catalog/years/:year', cachedRoute(60, (req) => preferredCatalog(req).byYear(z.string().regex(/^\d{4}$/).parse(req.params.year), queryFilters(req.query))));

// Một request cho toàn bộ menu điều hướng, thay vì 3 request song song lúc mở trang.
app.get('/api/catalog/navigation', cachedRoute(600, async (req) => {
  const resolver = preferredCatalog(req);
  const [genres, countries, years] = await Promise.all([
    taxonomyWithFallback(() => resolver.genres(), listGenresFromDb),
    taxonomyWithFallback(() => resolver.countries(), listCountriesFromDb),
    taxonomyWithFallback(() => resolver.years(), listYearsFromDb)
  ]);
  return { genres: genres.items, countries: countries.items, years: years.items };
}));

app.get('/api/catalog/codes', cachedRoute(600, (req) => preferredCatalog(req).codes()));
app.get('/api/catalog/codes/:code', cachedRoute(60, (req) => preferredCatalog(req).byCode(z.string().trim().min(1).max(80).parse(req.params.code), queryFilters(req.query))));
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

app.get('/api/movies', asyncRoute(async (req, res) => {
  const query = moviesQuerySchema.parse(req.query);
  res.json(await listMovies({ ...query, q: query.q || undefined }));
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
app.get('/api/search', asyncRoute(async (req, res) => {
  const query = z.object({
    q: z.string().trim().min(1).max(100),
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24)
  }).parse(req.query);
  const [movies, people] = await Promise.all([
    listMovies({ q: query.q, page: query.page, limit: query.limit, sort: 'recent' }),
    listPeople({ q: query.q, page: 1, limit: 8 })
  ]);
  res.json({ query: query.q, movies, people: people.items });
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
  void syncLatest(pages.pages).catch((error) => console.error('Catalog sync failed:', error)); res.status(202).json({ started: true });
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
  queueImport(slug, preferredCatalog(req));
  try {
    await waitForImport(slug);
  } finally {
    forgetImport(slug);
  }
  res.json({ movie: await getMovie(slug, true) });
}));
// Tìm trực tiếp ở nguồn ngoài, bỏ qua kho đã lưu. Alias `/api/vsmov/search` của
// bản một-nguồn đã bỏ: tên nguồn không còn nằm trong đường dẫn nữa.
app.get('/api/provider/search', asyncRoute(async (req, res) => res.json(await preferredCatalog(req).search(z.string().trim().min(2).parse(req.query.q), queryFilters(req.query)))));

// Playlist HLS đã bóc quảng cáo của nguồn — xem docs/ads.md.
app.use('/api/stream', streamRouter);

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
