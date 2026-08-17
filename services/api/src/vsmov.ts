import type { CatalogFilters, CatalogProvider } from './providers/types.js';

const base = (process.env.VSMOV_API_URL ?? 'https://vsmov.com/api').replace(/\/$/, '');
const cache = new Map<string, { expires: number; value: unknown }>();

function queryString(filters: CatalogFilters & { keyword?: string }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

async function request(path: string, ttlMs = 120_000) {
  const key = `${base}${path}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value as any;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(key, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'BaoNhanCinema/0.2' } });
    if (!response.ok) throw new Error(`VSMOV HTTP ${response.status}`);
    const value = await response.json();
    cache.set(key, { expires: Date.now() + ttlMs, value });
    return value as any;
  } finally { clearTimeout(timer); }
}

function movieSummary(item: any) {
  return {
    id: Number(item._id ?? 0), provider: 'vsmov', providerId: item._id == null ? null : String(item._id), slug: String(item.slug ?? ''),
    name: String(item.name ?? item.origin_name ?? ''), originName: item.origin_name ?? null,
    description: item.content ?? null, type: item.type ?? item.tmdb?.type ?? 'single', status: item.status ?? null,
    year: Number(item.year ?? 0) || null, duration: item.time ?? null, quality: item.quality ?? null,
    language: item.lang ?? null, posterUrl: typeof item.poster_url === 'string' ? item.poster_url : null,
    thumbUrl: typeof item.thumb_url === 'string' ? item.thumb_url : null, trailerUrl: item.trailer_url ?? null,
    rating: Number(item.tmdb?.vote_average ?? item.rating ?? 0) || null, viewCount: Number(item.view ?? 0),
    tmdbId: item.tmdb?.id ? String(item.tmdb.id) : null, imdbId: item.imdb?.id ? String(item.imdb.id) : null,
    genres: Array.isArray(item.category) ? item.category.map((x: any) => x.name).filter(Boolean) : [],
    countries: Array.isArray(item.country) ? item.country.map((x: any) => x.name).filter(Boolean) : [],
    actors: Array.isArray(item.actor) ? item.actor : [], directors: Array.isArray(item.director) ? item.director : []
  };
}

function normalizeList(payload: any) {
  const items = payload?.items ?? payload?.data?.items ?? [];
  const pagination = payload?.pagination ?? payload?.data?.pagination ?? {};
  const limit = Number(pagination.totalItemsPerPage ?? pagination.limit ?? 24);
  const totalItems = Number(pagination.totalItems ?? items.length);
  return { items: items.map(movieSummary), pagination: { totalItems, totalPages: Number(pagination.totalPages ?? Math.max(1, Math.ceil(totalItems / limit))), currentPage: Number(pagination.currentPage ?? 1), totalItemsPerPage: limit } };
}

function normalizeTaxonomy(payload: any) {
  const items = payload?.data?.items ?? payload?.items ?? [];
  return { items: items.map((item: any) => ({ id: item._id ?? item.id ?? item.slug, name: String(item.name ?? item.slug ?? ''), slug: String(item.slug ?? item.name ?? ''), thumbUrl: typeof item.thumb_url === 'string' ? item.thumb_url : null })) };
}

async function catalogList(path: string, filters: CatalogFilters = {}) { return normalizeList(await request(`${path}${queryString(filters)}`)); }

export const vsmov: CatalogProvider = {
  name: 'vsmov',
  latest: (page: number, limit = 24) => request(`/danh-sach/phim-moi-cap-nhat${queryString({ page, limit })}`),
  home: (filters: CatalogFilters = {}) => catalogList('/danh-sach/phim-moi-cap-nhat', filters),
  list: (slug: string, filters: CatalogFilters = {}) => catalogList(`/danh-sach/${encodeURIComponent(slug)}`, filters),
  search: async (keyword: string, filters: CatalogFilters = {}) => normalizeList(await request(`/tim-kiem${queryString({ ...filters, keyword })}`, 30_000)),
  genres: async () => normalizeTaxonomy(await request('/the-loai', 3_600_000)),
  byGenre: (slug: string, filters: CatalogFilters = {}) => catalogList(`/the-loai/${encodeURIComponent(slug)}`, filters),
  countries: async () => normalizeTaxonomy(await request('/quoc-gia', 3_600_000)),
  byCountry: (slug: string, filters: CatalogFilters = {}) => catalogList(`/quoc-gia/${encodeURIComponent(slug)}`, filters),
  years: async () => normalizeTaxonomy(await request('/nam', 3_600_000)),
  byYear: (year: string, filters: CatalogFilters = {}) => catalogList(`/nam/${encodeURIComponent(year)}`, filters),
  actors: async () => normalizeTaxonomy(await request('/dien-vien', 3_600_000)),
  codes: async () => normalizeTaxonomy(await request('/code', 3_600_000)),
  byCode: (code: string, filters: CatalogFilters = {}) => catalogList(`/code/${encodeURIComponent(code)}`, filters),
  detail: (slug: string) => request(`/phim/${encodeURIComponent(slug)}`, 60_000)
};
