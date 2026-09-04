/**
 * Adapter cho nguồn VSMOV (nguồn phát mặc định hiện tại).
 *
 * Chuyển từ `src/vsmov.ts` vào đây khi tách tầng đa nguồn. Khác bản cũ ở hai
 * điểm: mọi hàm trả về shape đã chuẩn hoá (`ListPage`/`Taxonomy`/`SourceDetail`)
 * thay vì JSON thô của nguồn, và `latest()` cũng được chuẩn hoá — trước đây nó
 * trả thô nên `sync.ts` phải biết tên field của vsmov.
 */
import { getJson, queryString } from './http.js';
import { emptyMovie, imageUrl, makePagination, names, num, str } from './normalize.js';
import type {
  CatalogFilters, CatalogSource, EpisodeGroup, ListPage, MovieSummary, SourceDetail, Taxonomy
} from './types.js';

const base = (process.env.VSMOV_API_URL ?? 'https://vsmov.com/api').replace(/\/$/, '');
const SOURCE = 'vsmov';

const request = <T = any>(path: string, ttlMs?: number) =>
  getJson<T>(`${base}${path}`, { source: SOURCE, ttlMs });

/** Payload của nguồn có lúc phẳng, có lúc bọc trong `data` — nhận cả hai. */
const unwrap = (payload: any) => payload?.data ?? payload ?? {};

function movieSummary(item: any): MovieSummary {
  const slug = str(item?.slug) ?? '';
  const name = str(item?.name) ?? str(item?.origin_name) ?? slug;
  return {
    ...emptyMovie(SOURCE, slug, name),
    providerId: item?._id == null ? null : String(item._id),
    originName: str(item?.origin_name),
    description: str(item?.content) ?? str(item?.description),
    type: str(item?.type) ?? str(item?.tmdb?.type) ?? 'single',
    status: str(item?.status),
    year: num(item?.year),
    duration: str(item?.time) ?? str(item?.duration),
    quality: str(item?.quality),
    language: str(item?.lang) ?? str(item?.language),
    posterUrl: imageUrl(item?.poster_url),
    thumbUrl: imageUrl(item?.thumb_url),
    trailerUrl: str(item?.trailer_url),
    rating: num(item?.tmdb?.vote_average) ?? num(item?.rating),
    viewCount: Math.max(0, Math.trunc(Number(item?.view) || 0)),
    tmdbId: item?.tmdb?.id == null ? null : String(item.tmdb.id),
    imdbId: item?.imdb?.id == null ? null : String(item.imdb.id),
    genres: names(item?.category),
    countries: names(item?.country),
    actors: names(item?.actor),
    directors: names(item?.director)
  };
}

function normalizeList(payload: any, fallbackLimit = 24): ListPage {
  const data = unwrap(payload);
  const rawItems: any[] = Array.isArray(data.items) ? data.items : Array.isArray(payload?.items) ? payload.items : [];
  // Bỏ item không có slug: slug là khoá duy nhất của phim trong DB và trong URL,
  // không có slug thì phim đó không mở được, hiện ra chỉ để người dùng bấm vào lỗi.
  const items = rawItems.map(movieSummary).filter((movie) => movie.slug && movie.name);
  const pagination = data.pagination ?? payload?.pagination ?? {};
  return {
    items,
    pagination: makePagination({
      totalItems: pagination.totalItems,
      totalPages: pagination.totalPages,
      currentPage: pagination.currentPage,
      limit: pagination.totalItemsPerPage ?? pagination.limit ?? fallbackLimit,
      itemCount: items.length
    })
  };
}

function normalizeTaxonomy(payload: any): Taxonomy {
  const data = unwrap(payload);
  const rawItems: any[] = Array.isArray(data.items) ? data.items : Array.isArray(payload?.items) ? payload.items : [];
  return {
    items: rawItems
      .map((item) => {
        const name = str(item?.name) ?? str(item?.slug) ?? '';
        const slug = str(item?.slug) ?? str(item?.name) ?? '';
        return { id: String(item?._id ?? item?.id ?? slug), name, slug, thumbUrl: imageUrl(item?.thumb_url) };
      })
      .filter((item) => item.name && item.slug)
  };
}

function normalizeEpisodes(payload: any): EpisodeGroup[] {
  const groups: any[] = Array.isArray(payload) ? payload : [];
  return groups
    .map((group) => ({
      server_name: str(group?.server_name) ?? 'Mặc định',
      server_data: (Array.isArray(group?.server_data) ? group.server_data : [])
        .map((entry: any) => ({
          name: str(entry?.name) ?? str(entry?.filename) ?? 'Full',
          filename: str(entry?.filename),
          link_embed: str(entry?.link_embed) ?? '',
          link_m3u8: str(entry?.link_m3u8)
        }))
        .filter((entry: { link_embed: string }) => entry.link_embed)
    }))
    .filter((group) => group.server_data.length);
}

const listAt = async (path: string, filters: CatalogFilters = {}): Promise<ListPage> =>
  normalizeList(await request(`${path}${queryString(filters)}`), filters.limit ?? 24);

export const vsmov: CatalogSource = {
  name: SOURCE,
  kind: 'playable',
  latest: (page: number, limit = 24) => listAt('/danh-sach/phim-moi-cap-nhat', { page, limit }),
  home: (filters = {}) => listAt('/danh-sach/phim-moi-cap-nhat', filters),
  list: (slug, filters = {}) => listAt(`/danh-sach/${encodeURIComponent(slug)}`, filters),
  search: async (keyword, filters = {}) =>
    normalizeList(await request(`/tim-kiem${queryString({ ...filters, keyword })}`, 30_000), filters.limit ?? 24),
  genres: async () => normalizeTaxonomy(await request('/the-loai', 3_600_000)),
  byGenre: (slug, filters = {}) => listAt(`/the-loai/${encodeURIComponent(slug)}`, filters),
  countries: async () => normalizeTaxonomy(await request('/quoc-gia', 3_600_000)),
  byCountry: (slug, filters = {}) => listAt(`/quoc-gia/${encodeURIComponent(slug)}`, filters),
  years: async () => normalizeTaxonomy(await request('/nam', 3_600_000)),
  byYear: (year, filters = {}) => listAt(`/nam/${encodeURIComponent(year)}`, filters),
  actors: async () => normalizeTaxonomy(await request('/dien-vien', 3_600_000)),
  codes: async () => normalizeTaxonomy(await request('/code', 3_600_000)),
  byCode: (code, filters = {}) => listAt(`/code/${encodeURIComponent(code)}`, filters),
  detail: async (slug): Promise<SourceDetail> => {
    const payload = await request(`/phim/${encodeURIComponent(slug)}`, 60_000);
    const data = unwrap(payload);
    const raw = data.movie ?? payload?.movie;
    if (!raw) throw new Error(`Nguồn ${SOURCE} không trả về phim cho slug "${slug}"`);
    const movie = movieSummary(raw);
    // Nguồn thỉnh thoảng trả `slug` rỗng ở bản detail; giữ slug người dùng đã hỏi
    // để không tạo bản ghi mồ côi trong DB.
    if (!movie.slug) movie.slug = slug;
    return { movie, episodes: normalizeEpisodes(data.episodes ?? payload?.episodes) };
  }
};

/** Dùng trong test để bơm base URL giả mà không phải nạp lại module. */
export const vsmovBaseUrl = base;
