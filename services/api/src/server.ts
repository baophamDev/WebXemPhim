import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import {
  closeDatabase, getContinue, getEpisodes, getMovie, getSyncState, initDatabase, isFavorite,
  listActors, listFavorites, listMovies, saveProgress, toggleFavorite, upsertEpisodes, upsertMovie
} from './db.js';
import { catalogProvider, type CatalogFilters } from './providers/index.js';
import { syncLatest } from './sync.js';

const app = express();
const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
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

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'bao-nhan-cinema-api', provider: catalogProvider.name, time: new Date().toISOString() }));
app.get('/api/catalog/home', asyncRoute(async (req, res) => res.json(await catalogProvider.home(queryFilters(req.query)))));
app.get('/api/catalog/lists/:slug', asyncRoute(async (req, res) => res.json(await catalogProvider.list(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/search', asyncRoute(async (req, res) => res.json(await catalogProvider.search(z.string().trim().min(2).max(100).parse(req.query.q), queryFilters(req.query)))));
app.get('/api/catalog/genres', asyncRoute(async (_req, res) => res.json(await catalogProvider.genres())));
app.get('/api/catalog/genres/:slug', asyncRoute(async (req, res) => res.json(await catalogProvider.byGenre(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/countries', asyncRoute(async (_req, res) => res.json(await catalogProvider.countries())));
app.get('/api/catalog/countries/:slug', asyncRoute(async (req, res) => res.json(await catalogProvider.byCountry(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/years', asyncRoute(async (_req, res) => res.json(await catalogProvider.years())));
app.get('/api/catalog/years/:year', asyncRoute(async (req, res) => res.json(await catalogProvider.byYear(z.string().regex(/^\d{4}$/).parse(req.params.year), queryFilters(req.query)))));
app.get('/api/catalog/actors', asyncRoute(async (_req, res) => { const local = await listActors(); res.json(local.items.length ? local : await catalogProvider.actors()); }));
app.get('/api/catalog/codes', asyncRoute(async (_req, res) => res.json(await catalogProvider.codes())));
app.get('/api/catalog/codes/:code', asyncRoute(async (req, res) => res.json(await catalogProvider.byCode(z.string().trim().min(1).max(80).parse(req.params.code), queryFilters(req.query)))));
app.get('/api/catalog/movies/:slug', asyncRoute(async (req, res) => { const slug = slugSchema.parse(req.params.slug); res.json({ movie: await getMovie(slug, true) ?? await importDetail(slug) }); }));

app.get('/api/movies', asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1)); const limit = Math.min(48, Math.max(1, Number(req.query.limit ?? 24)));
  res.json(await listMovies({ page, limit, q: String(req.query.q ?? '').trim() || undefined, genre: String(req.query.genre ?? '').trim() || undefined, sort: String(req.query.sort ?? '') }));
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

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const upstream = error?.name === 'AbortError' || String(error?.message).includes('HTTP');
  res.status(upstream ? 502 : 400).json({ message: error?.issues?.[0]?.message ?? error?.message ?? 'Yêu cầu không hợp lệ' });
});

const port = Number(process.env.PORT ?? 4000); const host = process.env.HOST ?? '0.0.0.0';
async function start() {
  await initDatabase();
  app.listen(port, host, () => console.log(`BaoNhanCinema API listening on http://${host}:${port}`));
}

void start().catch((error) => { console.error('API startup failed:', error); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void closeDatabase().finally(() => process.exit(0)));
