import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import {
  closeDatabase, getContinue, getEpisodes, getMovie, getPerson, getSyncState, initDatabase, isFavorite,
  listCountriesFromDb, listFavorites, listGenresFromDb, listMovies, listPeople, listYearsFromDb,
  saveProgress, toggleFavorite, updatePeopleThumbs, upsertEpisodes, upsertMovie
} from './db.js';
import { catalogProvider, type CatalogFilters } from './providers/index.js';
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

const asyncRoute = (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => handler(req, res).catch(next);

const filtersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(48).default(24),
  year: z.string().trim().optional(), country: z.string().trim().optional(), category: z.string().trim().optional(),
  type: z.enum(['single', 'series', 'hoathinh', 'tvshows']).optional(), status: z.enum(['trailer', 'ongoing', 'completed']).optional()
});
const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._-]+$/);
const idSchema = z.coerce.number().int().positive();
const queryFilters = (query: express.Request['query']) => filtersSchema.parse(query) as CatalogFilters;

async function importDetail(slug: string) {
  const detail = await catalogProvider.detail(slug);
  const movieId = await upsertMovie(detail.movie);
  await upsertEpisodes(movieId, detail.episodes);
  return getMovie(slug, true);
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
    const remote = await catalogProvider.actors();
    const updated = await updatePeopleThumbs(remote.items.map((item: any) => ({ name: item.name, thumbUrl: item.thumbUrl })));
    if (updated) console.log(`Đã cập nhật ảnh cho ${updated} diễn viên`);
  } catch (error) {
    console.warn('Không lấy được ảnh diễn viên từ provider:', (error as Error).message);
  }
}

/**
 * Taxonomy ưu tiên provider (có slug chuẩn để gọi tiếp), provider chết thì dựng
 * từ DB để menu điều hướng không bao giờ trắng.
 */
async function taxonomyWithFallback(
  fromProvider: () => Promise<{ items: unknown[] }>,
  fromDb: () => Promise<readonly Record<string, any>[]>
) {
  try {
    const remote = await fromProvider();
    if (remote.items.length) return { source: 'provider', items: remote.items };
  } catch (error) {
    console.warn('Taxonomy provider lỗi, chuyển sang DB:', (error as Error).message);
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

/** Trạng thái kết nối DB, do initDatabaseWithRetry() ở cuối file cập nhật. */
export const dbState = { ready: false, error: null as string | null };

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'bao-nhan-cinema-api', provider: catalogProvider.name, database: dbState.ready ? 'ready' : 'connecting', databaseError: dbState.error, time: new Date().toISOString() }));
app.get('/api/catalog/home', asyncRoute(async (req, res) => res.json(await catalogProvider.home(queryFilters(req.query)))));
app.get('/api/catalog/lists/:slug', asyncRoute(async (req, res) => res.json(await catalogProvider.list(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/search', asyncRoute(async (req, res) => res.json(await catalogProvider.search(z.string().trim().min(2).max(100).parse(req.query.q), queryFilters(req.query)))));
app.get('/api/catalog/genres', asyncRoute(async (_req, res) => res.json(await taxonomyWithFallback(() => catalogProvider.genres(), listGenresFromDb))));
app.get('/api/catalog/genres/:slug', asyncRoute(async (req, res) => res.json(await catalogProvider.byGenre(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/countries', asyncRoute(async (_req, res) => res.json(await taxonomyWithFallback(() => catalogProvider.countries(), listCountriesFromDb))));
app.get('/api/catalog/countries/:slug', asyncRoute(async (req, res) => res.json(await catalogProvider.byCountry(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/years', asyncRoute(async (_req, res) => res.json(await taxonomyWithFallback(() => catalogProvider.years(), listYearsFromDb))));
app.get('/api/catalog/years/:year', asyncRoute(async (req, res) => res.json(await catalogProvider.byYear(z.string().regex(/^\d{4}$/).parse(req.params.year), queryFilters(req.query)))));

// Một request cho toàn bộ menu điều hướng, thay vì 3 request song song lúc mở trang.
app.get('/api/catalog/navigation', asyncRoute(async (_req, res) => {
  const [genres, countries, years] = await Promise.all([
    taxonomyWithFallback(() => catalogProvider.genres(), listGenresFromDb),
    taxonomyWithFallback(() => catalogProvider.countries(), listCountriesFromDb),
    taxonomyWithFallback(() => catalogProvider.years(), listYearsFromDb)
  ]);
  res.header('Cache-Control', 'public, max-age=600');
  res.json({ genres: genres.items, countries: countries.items, years: years.items });
}));

app.get('/api/catalog/codes', asyncRoute(async (_req, res) => res.json(await catalogProvider.codes())));
app.get('/api/catalog/codes/:code', asyncRoute(async (req, res) => res.json(await catalogProvider.byCode(z.string().trim().min(1).max(80).parse(req.params.code), queryFilters(req.query)))));
app.get('/api/catalog/movies/:slug', asyncRoute(async (req, res) => { const slug = slugSchema.parse(req.params.slug); res.json({ movie: await getMovie(slug, true) ?? await importDetail(slug) }); }));

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

app.get('/api/movies/:slug', asyncRoute(async (req, res) => {
  const slug = slugSchema.parse(req.params.slug); const movie = await getMovie(slug, true) ?? await importDetail(slug);
  if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim' }); res.json({ movie });
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
app.post('/api/import/:slug', asyncRoute(async (req, res) => res.json({ movie: await importDetail(slugSchema.parse(req.params.slug)) })));
app.get('/api/provider/search', asyncRoute(async (req, res) => res.json(await catalogProvider.search(z.string().trim().min(2).parse(req.query.q), queryFilters(req.query)))));
app.get('/api/vsmov/search', asyncRoute(async (req, res) => res.json(await catalogProvider.search(z.string().trim().min(2).parse(req.query.q), queryFilters(req.query)))));

// Playlist HLS đã bóc quảng cáo của nguồn — xem docs/ads.md.
app.use('/api/stream', streamRouter);

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const upstream = error?.name === 'AbortError' || String(error?.message).includes('HTTP');
  const status = Number.isInteger(error?.status) ? error.status : (upstream ? 502 : 400);
  res.status(status).json({ message: error?.issues?.[0]?.message ?? error?.message ?? 'Yêu cầu không hợp lệ' });
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
    dbState.ready = true; dbState.error = null;
    console.log('Database ready');
  } catch (error) {
    dbState.ready = false; dbState.error = (error as Error).message;
    const delay = Math.min(30_000, 2_000 * 2 ** (attempt - 1));
    console.error(`Database init failed (lần ${attempt}), thử lại sau ${delay}ms:`, dbState.error);
    setTimeout(() => void initDatabaseWithRetry(attempt + 1), delay).unref();
  }
}

app.listen(port, host, () => {
  console.log(`BaoNhanCinema API listening on http://${host}:${port}`);
  void initDatabaseWithRetry();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void closeDatabase().finally(() => process.exit(0)));
