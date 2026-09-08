/**
 * Nguồn phim duy nhất: VSMOV (https://vsmov.com/api-document).
 *
 * Mọi hàm trả về shape đã chuẩn hoá (`ListPage`/`Taxonomy`/`SourceDetail`)
 * thay vì JSON thô của nguồn. Hành vi thật của từng endpoint (param nào được
 * đọc, param nào bị bỏ qua) đã đối chiếu bằng request và ghi ở `types.ts`.
 */
import { getJson, queryString } from './http.js';
import { emptyMovie, imageUrl, makePagination, names, num, str } from './normalize.js';
import type {
  CatalogFilters, EpisodeGroup, ListPage, MovieSummary, SourceDetail, Taxonomy
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

/**
 * Chọn lọc tham số gửi lên nguồn theo từng nhóm endpoint, đã đối chiếu bằng
 * request thật (xem ghi chú trong `types.ts`). Nhóm `/danh-sach/:slug` bỏ qua
 * `limit` (tự ép 24 hoặc 20) lẫn mọi bộ lọc `year`/`country`/`category` —
 * giữ chúng trong URL chỉ tạo cache-key thừa mà kết quả không đổi.
 */
const danhsachAt = (slug: string, filters: CatalogFilters = {}): Promise<ListPage> =>
  listAt(`/danh-sach/${encodeURIComponent(slug)}`, pick(filters, 'page', 'type', 'status'));

/** Chỉ gửi khoá có trong danh sách cho phép; phần còn lại bỏ ở máy mình. */
function pick(filters: CatalogFilters, ...keys: (keyof CatalogFilters)[]): CatalogFilters {
  const kept: Record<string, string | number> = {};
  for (const key of keys) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim()) kept[key] = value;
  }
  return kept as CatalogFilters;
}

export const vsmov = {
  name: SOURCE,
  latest: (page: number) => listAt('/danh-sach/phim-moi-cap-nhat', { page }),
  home: (filters: CatalogFilters = {}) => listAt('/danh-sach/phim-moi-cap-nhat', pick(filters, 'page', 'type', 'status')),
  list: (slug: string, filters: CatalogFilters = {}) => danhsachAt(slug, filters),
  search: async (keyword: string, filters: CatalogFilters = {}) =>
    normalizeList(await request(`/tim-kiem${queryString({ ...filters, keyword })}`, 30_000), filters.limit ?? 24),
  genres: async (): Promise<Taxonomy> => normalizeTaxonomy(await request('/the-loai', 3_600_000)),
  byGenre: (slug: string, filters: CatalogFilters = {}) => listAt(`/the-loai/${encodeURIComponent(slug)}`, filters),
  countries: async (): Promise<Taxonomy> => normalizeTaxonomy(await request('/quoc-gia', 3_600_000)),
  byCountry: (slug: string, filters: CatalogFilters = {}) =>
    listAt(`/quoc-gia/${encodeURIComponent(slug)}`, pick(filters, 'page', 'limit', 'category', 'type', 'status')),
  years: async (): Promise<Taxonomy> => normalizeTaxonomy(await request('/nam', 3_600_000)),
  byYear: (year: string, filters: CatalogFilters = {}) =>
    listAt(`/nam/${encodeURIComponent(year)}`, pick(filters, 'page', 'limit', 'type', 'status')),
  actors: async (): Promise<Taxonomy> => normalizeTaxonomy(await request('/dien-vien', 3_600_000)),
  codes: async (): Promise<Taxonomy> => normalizeTaxonomy(await request('/code', 3_600_000)),
  byCode: (code: string, filters: CatalogFilters = {}) => danhsachAt(code, filters),
  detail: async (slug: string): Promise<SourceDetail> => {
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
