/**
 * Nguồn dự phòng KKPhim (https://phimapi.com, tài liệu: https://kkphim.com/api-document).
 *
 * KKPhim cùng gốc OPhim CMS với VSMOV nên shape gần như trùng: list có `items` +
 * `pagination`, detail có `movie` + `episodes[].server_data[].link_m3u8`. Khác
 * biệt đã đối chiếu bằng request thật (2026-09):
 *
 * - Nhóm `/danh-sach/:slug` và `/tim-kiem` là API cũ: `items` nằm ở gốc, tự ép
 *   24 phim/trang, **bỏ qua** `limit`/`type`/`status`. `/tim-kiem` đọc thêm
 *   `year`/`country`/`category` và không trả `pagination`.
 * - Danh mục theo giá trị (`/v1/api/the-loai|quoc-gia|nam/:slug`) đọc `page`,
 *   `limit`, `year`, `country`, `category` nhưng bỏ `type`/`status`; phân trang
 *   nằm trong `data.params.pagination`.
 * - Không có endpoint diễn viên (`/dien-vien`), mã (`/code`) hay danh sách năm
 *   (`/nam`) — trả rỗng ngay để resolver rơi xuống DB, thay vì gọi 404 rồi cũng
 *   phải rơi xuống DB.
 *
 * Điểm mạnh so với VSMOV hiện tại: `link_m3u8` thật (VSMOV đang trả link rỗng ở
 * mọi tập), nên đây là nguồn để lớp resolver bồi vào khi VSMOV chết hoặc không
 * có luồng phát được.
 */
import { getJson, queryString } from './http.js';
import { emptyMovie, imageUrl, makePagination, names, num, sameTitle, searchKeywords, str } from './normalize.js';
import type {
  CatalogFilters, EpisodeGroup, ListPage, MovieSummary, SourceDetail, Taxonomy
} from './types.js';

const base = (process.env.KKPHIM_API_URL ?? 'https://phimapi.com').replace(/\/$/, '');
const SOURCE = 'kkphim';

const request = <T = any>(path: string, ttlMs?: number) =>
  getJson<T>(`${base}${path}`, { source: SOURCE, ttlMs });

/** Payload có lúc phẳng, có lúc bọc trong `data` (nhóm v1) — nhận cả hai. */
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
  const items = rawItems.map(movieSummary).filter((movie) => movie.slug && movie.name);
  // Nhóm v1 giấu phân trang trong `data.params.pagination`; nhóm cũ để ở gốc.
  const pagination = data.params?.pagination ?? data.pagination ?? payload?.pagination ?? {};
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

/** Chỉ gửi khoá có trong danh sách cho phép; phần còn lại nguồn bỏ qua (xem đầu file). */
function pick(filters: CatalogFilters, ...keys: (keyof CatalogFilters)[]): CatalogFilters {
  const kept: Record<string, string | number> = {};
  for (const key of keys) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim()) kept[key] = value;
  }
  return kept as CatalogFilters;
}

const danhsachAt = (slug: string, filters: CatalogFilters = {}): Promise<ListPage> =>
  listAt(`/danh-sach/${encodeURIComponent(slug)}`, pick(filters, 'page'));

export const kkphim = {
  name: SOURCE,
  latest: (page: number) => listAt('/danh-sach/phim-moi-cap-nhat', { page }),
  home: (filters: CatalogFilters = {}) => listAt('/danh-sach/phim-moi-cap-nhat', pick(filters, 'page')),
  list: (slug: string, filters: CatalogFilters = {}) => danhsachAt(slug, filters),
  search: async (keyword: string, filters: CatalogFilters = {}) =>
    normalizeList(
      await request(`/tim-kiem${queryString({ ...pick(filters, 'page', 'limit', 'year', 'country', 'category'), keyword })}`, 30_000),
      filters.limit ?? 24
    ),
  genres: async (): Promise<Taxonomy> => normalizeTaxonomy(await request('/the-loai', 3_600_000)),
  byGenre: (slug: string, filters: CatalogFilters = {}) =>
    listAt(`/v1/api/the-loai/${encodeURIComponent(slug)}`, pick(filters, 'page', 'limit', 'year', 'country', 'category')),
  countries: async (): Promise<Taxonomy> => normalizeTaxonomy(await request('/quoc-gia', 3_600_000)),
  byCountry: (slug: string, filters: CatalogFilters = {}) =>
    listAt(`/v1/api/quoc-gia/${encodeURIComponent(slug)}`, pick(filters, 'page', 'limit', 'year', 'category')),
  // KKPhim không có endpoint danh sách năm/diễn viên/mã — trả rỗng để resolver
  // và `taxonomyWithFallback` rơi xuống DB, không tốn một request 404.
  years: async (): Promise<Taxonomy> => ({ items: [] }),
  byYear: (year: string, filters: CatalogFilters = {}) =>
    listAt(`/v1/api/nam/${encodeURIComponent(year)}`, pick(filters, 'page', 'limit', 'country', 'category')),
  actors: async (): Promise<Taxonomy> => ({ items: [] }),
  codes: async (): Promise<Taxonomy> => ({ items: [] }),
  byCode: (code: string, filters: CatalogFilters = {}) => danhsachAt(code, filters),
  detail: async (slug: string): Promise<SourceDetail> => {
    const payload = await request(`/phim/${encodeURIComponent(slug)}`, 60_000);
    const data = unwrap(payload);
    const raw = data.movie ?? payload?.movie;
    if (!raw) throw new Error(`Nguồn ${SOURCE} không trả về phim cho slug "${slug}"`);
    const movie = movieSummary(raw);
    if (!movie.slug) movie.slug = slug;
    return { movie, episodes: normalizeEpisodes(data.episodes ?? payload?.episodes) };
  },

  /**
   * Tìm bản tương ứng của một phim **đến từ nguồn khác** (slug khác hệ): thử
   * thẳng `/phim/:slug` trước, không có thì tìm theo tên rồi mới lấy detail.
   * Dùng cho resolver khi VSMOV có phim nhưng không có luồng phát được.
   */
  detailLike: async (wanted: { slug: string; name: string; originName?: string | null; year?: number | null }): Promise<SourceDetail | null> => {
    try {
      return await kkphim.detail(wanted.slug);
    } catch { /* slug khác hệ, chuyển sang tìm theo tên */ }
    // Tên hai nguồn có thể khác dạng (thêm hậu tố trong ngoặc, hoặc chỉ khớp
    // tên gốc), nên thử lần lượt vài từ khoá trước khi bỏ cuộc.
    for (const keyword of searchKeywords(wanted)) {
      const found: any = await request(`/tim-kiem${queryString({ keyword, limit: 10 })}`, 30_000);
      const data = unwrap(found);
      const items: any[] = Array.isArray(data.items) ? data.items : [];
      const match = items.find((item) => sameTitle(item?.name, item?.origin_name, wanted, item?.year));
      if (match?.slug) return kkphim.detail(String(match.slug));
    }
    return null;
  }
};

/** Dùng trong test để bơm base URL giả mà không phải nạp lại module. */
export const kkphimBaseUrl = base;
