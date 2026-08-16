import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { getContinue, getEpisodes, getMovie, getSyncState, isFavorite, listActors, listFavorites, listMovies, saveProgress, toggleFavorite, upsertEpisodes, upsertMovie } from './db.js';
import { vsmov, type CatalogFilters } from './vsmov.js';
import { syncLatest } from './sync.js';

const app = express();
app.use(cors({ origin: true }));
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
  const detail = await vsmov.detail(slug);
  const movieId = upsertMovie(detail.movie);
  upsertEpisodes(movieId, detail.episodes);
  return getMovie(slug, true);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'local-cinema-api', time: new Date().toISOString() }));

app.get('/api/catalog/home', asyncRoute(async (req, res) => res.json(await vsmov.home(queryFilters(req.query)))));
app.get('/api/catalog/lists/:slug', asyncRoute(async (req, res) => res.json(await vsmov.list(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/search', asyncRoute(async (req, res) => { const keyword = z.string().trim().min(2).max(100).parse(req.query.q); res.json(await vsmov.search(keyword, queryFilters(req.query))); }));
app.get('/api/catalog/genres', asyncRoute(async (_req, res) => res.json(await vsmov.genres())));
app.get('/api/catalog/genres/:slug', asyncRoute(async (req, res) => res.json(await vsmov.byGenre(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/countries', asyncRoute(async (_req, res) => res.json(await vsmov.countries())));
app.get('/api/catalog/countries/:slug', asyncRoute(async (req, res) => res.json(await vsmov.byCountry(slugSchema.parse(req.params.slug), queryFilters(req.query)))));
app.get('/api/catalog/years', asyncRoute(async (_req, res) => res.json(await vsmov.years())));
app.get('/api/catalog/years/:year', asyncRoute(async (req, res) => res.json(await vsmov.byYear(z.string().regex(/^\d{4}$/).parse(req.params.year), queryFilters(req.query)))));
app.get('/api/catalog/actors', asyncRoute(async (_req, res) => { const local = listActors(); res.json(local.items.length ? local : await vsmov.actors()); }));
app.get('/api/catalog/codes', asyncRoute(async (_req, res) => res.json(await vsmov.codes())));
app.get('/api/catalog/codes/:code', asyncRoute(async (req, res) => res.json(await vsmov.byCode(z.string().trim().min(1).max(80).parse(req.params.code), queryFilters(req.query)))));
app.get('/api/catalog/movies/:slug', asyncRoute(async (req, res) => { const slug = slugSchema.parse(req.params.slug); res.json({ movie: getMovie(slug, true) ?? await importDetail(slug) }); }));

app.get('/api/movies', (req, res) => { const page = Math.max(1, Number(req.query.page ?? 1)); const limit = Math.min(48, Math.max(1, Number(req.query.limit ?? 24))); res.json(listMovies({ page, limit, q: String(req.query.q ?? '').trim() || undefined, genre: String(req.query.genre ?? '').trim() || undefined, sort: String(req.query.sort ?? '') })); });
app.get('/api/movies/:slug', asyncRoute(async (req, res) => { const slug = slugSchema.parse(req.params.slug); const movie = getMovie(slug, true) ?? await importDetail(slug); if (!movie) return res.status(404).json({ message: 'Không tìm thấy phim' }); res.json({ movie }); }));
app.get('/api/episodes/:id', (req, res) => { const id = idSchema.parse(req.params.id); const ep = getEpisodes(id); if (!ep) return res.status(404).json({ message: 'Không tìm thấy tập phim' }); res.json(ep); });
app.get('/api/continue-watching', (req, res) => res.json({ items: getContinue(String(req.query.deviceId ?? 'local-device')) }));
app.get('/api/favorites', (req, res) => res.json({ items: listFavorites(String(req.query.deviceId ?? 'local-device')) }));
app.get('/api/favorites/:movieId', (req, res) => res.json({ favorite: isFavorite(String(req.query.deviceId ?? 'local-device'), idSchema.parse(req.params.movieId)) }));
app.post('/api/favorites/:movieId', (req, res) => { const body = z.object({ deviceId: z.string().trim().min(1).max(120).default('local-device'), enabled: z.boolean() }).parse(req.body); toggleFavorite(body.deviceId, idSchema.parse(req.params.movieId), body.enabled); res.json({ favorite: body.enabled }); });
app.post('/api/watch-progress', (req, res) => { const body = z.object({ deviceId: z.string().trim().min(1).max(120).default('local-device'), episodeId: idSchema, position: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative(), completed: z.boolean().default(false) }).parse(req.body); if (!saveProgress(body.deviceId, body.episodeId, body.position, body.duration, body.completed)) return res.status(404).json({ message: 'Không tìm thấy tập phim' }); res.json({ ok: true }); });
app.get('/api/sync/status', (_req, res) => res.json(getSyncState()));
app.post('/api/sync/start', (req, res) => { if ((getSyncState() as any)?.status === 'running') return res.status(409).json(getSyncState()); const pages = z.object({ pages: z.number().int().min(1).max(20).optional() }).parse(req.body ?? {}); syncLatest(pages.pages).catch(() => undefined); res.status(202).json({ started: true }); });
app.post('/api/import/:slug', asyncRoute(async (req, res) => res.json({ movie: await importDetail(slugSchema.parse(req.params.slug)) })));
app.get('/api/vsmov/search', asyncRoute(async (req, res) => { const q = z.string().trim().min(2).parse(req.query.q); res.json(await vsmov.search(q, queryFilters(req.query))); }));

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error?.name === 'AbortError' || String(error?.message).startsWith('VSMOV HTTP') ? 502 : 400;
  res.status(status).json({ message: error?.issues?.[0]?.message ?? error?.message ?? 'Yêu cầu không hợp lệ' });
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
app.listen(port, host, () => {
  console.log(`Local Cinema API listening on http://${host}:${port}`);
  const state = getSyncState() as any;
  if (!state?.processed) syncLatest(1).catch((error) => console.error('Initial VSMOV sync failed:', error));
});
