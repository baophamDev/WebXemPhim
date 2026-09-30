/**
 * Nguồn dự phòng thứ ba: NguonC (https://phim.nguonc.com/api-document).
 *
 * API đã đổi so với bản OPhim cũ (đối chiếu bằng request thật, 2026-09):
 *
 * - Danh sách nằm ở `/films/phim-moi-cap-nhat`, `/films/danh-sach/:slug`,
 *   `/films/the-loai|quoc-gia|nam-phat-hanh/:slug`; 10 phim/trang, phân trang là
 *   `paginate` (snake_case) và nguồn chỉ đọc `page` — không có `limit`.
 * - `/films/danh-sach/phim-moi-cap-nhat` **không tồn tại** (404): slug đó phải đi
 *   qua `/films/phim-moi-cap-nhat`, nên `list()` tự đổi đường.
 * - Không có endpoint liệt kê thể loại/quốc gia/năm — trả rỗng để rơi xuống DB.
 * - Chi tiết: `movie.episodes[].items[]` chỉ có `embed`, **không có m3u8** (đã
 *   quét 20 phim). Metadata nằm trong object `category` theo nhóm ("Định dạng",
 *   "Thể loại", "Năm", "Quốc gia") chứ không phải mảng như hai nguồn kia, và bản
 *   detail thiếu `year` — bù từ bản search khi tìm theo tên.
 *
 * Vì không có m3u8 nên đây là nguồn **bồi tập** cho resolver: chỉ được hỏi khi
 * VSMOV lẫn KKPhim đều không có luồng phát, và khi đó giữ metadata của nguồn
 * chính, chỉ thay danh sách tập bằng embed của NguonC (embed thật, còn embed của
 * VSMOV hiện là player giả).
 */
import { fold } from '../text.js';
import { getJson, queryString } from './http.js';
import { emptyMovie, imageUrl, makePagination, num, sameTitle, searchKeywords, str } from './normalize.js';
import type {
  CatalogFilters, EpisodeGroup, ListPage, MovieSummary, SourceDetail, Taxonomy
} from './types.js';

const base = (process.env.NGUONC_API_URL ?? 'https://phim.nguonc.com/api').replace(/\/$/, '');
const SOURCE = 'nguonc';

const request = <T = any>(path: string, ttlMs?: number) =>
  getJson<T>(`${base}${path}`, { source: SOURCE, ttlMs });

/** Payload có lúc phẳng, có lúc bọc trong `data` — nhận cả hai. */
const unwrap = (payload: any) => payload?.data ?? payload ?? {};

/** NguonC gom metadata vào `category` theo nhóm; rút tên các mục của một nhóm. */
function groupNames(item: any, groupName: string): string[] {
  const groups = item?.category;
  if (!groups || typeof groups !== 'object') return [];
  const wanted = fold(groupName);
  const names: string[] = [];
  for (const entry of Object.values(groups) as any[]) {
    if (fold(entry?.group?.name) !== wanted) continue;
    for (const value of Array.isArray(entry?.list) ? entry.list : []) {
      const name = str(value?.name);
      if (name) names.push(name);
    }
  }
  return names;
}

/** "A, B, C" → ['A','B','C'] — NguonC để diễn viên/đạo diễn chung một chuỗi. */
const splitList = (value: unknown): string[] =>
  (str(value) ?? '').split(',').map((part) => part.trim()).filter(Boolean);

const TYPE_BY_GROUP: Record<string, string> = {
  'phim bo': 'series', 'phim le': 'single', 'hoat hinh': 'hoathinh', 'tv shows': 'tvshows'
};

/** Nhóm "Định dạng" quyết định `type`; không có thì đoán theo số tập. */
function typeOf(item: any): string {
  const label = groupNames(item, 'Định dạng')[0];
  const mapped = label ? TYPE_BY_GROUP[fold(label)] : undefined;
  if (mapped) return mapped;
  const total = num(item?.total_episodes);
  return total && total > 1 ? 'series' : 'single';
}

/** "Hoàn tất (50/50)" / "FULL" là đã đủ tập, "Tập 12" là đang chiếu. */
function statusOf(item: any): string | null {
  const label = fold(item?.current_episode);
  if (!label) return null;
  if (label.includes('hoan tat') || label.includes('full') || label.includes('complete')) return 'completed';
  return /\d/.test(label) ? 'ongoing' : null;
}

function movieSummary(item: any): MovieSummary {
  const slug = str(item?.slug) ?? '';
  const name = str(item?.name) ?? str(item?.original_name) ?? slug;
  return {
    ...emptyMovie(SOURCE, slug, name),
    originName: str(item?.original_name),
    description: str(item?.description),
    type: typeOf(item),
    status: statusOf(item),
    // Bản detail thiếu `year`; năm thật nằm trong nhóm "Năm" của `category`.
    year: num(item?.year) ?? num(groupNames(item, 'Năm')[0]),
    duration: str(item?.time),
    quality: str(item?.quality),
    language: str(item?.language),
    posterUrl: imageUrl(item?.poster_url ?? item?.poster_url_webp),
    thumbUrl: imageUrl(item?.thumb_url ?? item?.thumb_url_webp),
    trailerUrl: null,
    rating: null,
    viewCount: 0,
    tmdbId: null,
    imdbId: null,
    genres: groupNames(item, 'Thể loại'),
    countries: groupNames(item, 'Quốc gia'),
    actors: splitList(item?.casts),
    directors: splitList(item?.director)
  };
}

function normalizeList(payload: any, fallbackLimit = 24): ListPage {
  const data = unwrap(payload);
  const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
  const items = rawItems.map(movieSummary).filter((movie) => movie.slug && movie.name);
  const paginate = data.paginate ?? {};
  return {
    items,
    pagination: makePagination({
      totalItems: paginate.total_items,
      totalPages: paginate.total_page,
      currentPage: paginate.current_page,
      limit: paginate.items_per_page ?? fallbackLimit,
      itemCount: items.length
    })
  };
}

function normalizeEpisodes(payload: any): EpisodeGroup[] {
  const groups: any[] = Array.isArray(payload) ? payload : [];
  return groups
    .map((group) => ({
      server_name: str(group?.server_name) ?? 'Mặc định',
      server_data: (Array.isArray(group?.items) ? group.items : [])
        .map((entry: any) => ({
          name: str(entry?.name) ?? str(entry?.slug) ?? 'Full',
          filename: null,
          link_embed: str(entry?.embed) ?? '',
          // NguonC chỉ phát qua embed — không có m3u8 ở bất kỳ tập nào.
          link_m3u8: null
        }))
        .filter((entry: { link_embed: string }) => entry.link_embed)
    }))
    .filter((group) => group.server_data.length);
}

const listAt = async (path: string, filters: CatalogFilters = {}, extra: Record<string, unknown> = {}): Promise<ListPage> =>
  normalizeList(await request(`${path}${queryString({ page: filters.page, ...extra })}`), filters.limit ?? 24);

export const nguonc = {
  name: SOURCE,
  latest: (page: number) => listAt('/films/phim-moi-cap-nhat', { page }),
  home: (filters: CatalogFilters = {}) => listAt('/films/phim-moi-cap-nhat', filters),
  // `/films/danh-sach/phim-moi-cap-nhat` không tồn tại: slug dùng ở rail trang
  // chủ phải đi qua đường riêng của nguồn.
  list: (slug: string, filters: CatalogFilters = {}) =>
    listAt(slug === 'phim-moi-cap-nhat' ? '/films/phim-moi-cap-nhat' : `/films/danh-sach/${encodeURIComponent(slug)}`, filters),
  search: (keyword: string, filters: CatalogFilters = {}) => listAt('/films/search', filters, { keyword }),
  // Không có endpoint liệt kê danh mục — trả rỗng để resolver rơi xuống DB.
  genres: async (): Promise<Taxonomy> => ({ items: [] }),
  byGenre: (slug: string, filters: CatalogFilters = {}) => listAt(`/films/the-loai/${encodeURIComponent(slug)}`, filters),
  countries: async (): Promise<Taxonomy> => ({ items: [] }),
  byCountry: (slug: string, filters: CatalogFilters = {}) => listAt(`/films/quoc-gia/${encodeURIComponent(slug)}`, filters),
  years: async (): Promise<Taxonomy> => ({ items: [] }),
  byYear: (year: string, filters: CatalogFilters = {}) => listAt(`/films/nam-phat-hanh/${encodeURIComponent(year)}`, filters),
  actors: async (): Promise<Taxonomy> => ({ items: [] }),
  codes: async (): Promise<Taxonomy> => ({ items: [] }),
  byCode: (code: string, filters: CatalogFilters = {}) => listAt(`/films/danh-sach/${encodeURIComponent(code)}`, filters),
  detail: async (slug: string): Promise<SourceDetail> => {
    const payload = await request(`/film/${encodeURIComponent(slug)}`, 60_000);
    const data = unwrap(payload);
    const raw = data.movie ?? payload?.movie;
    if (!raw) throw new Error(`Nguồn ${SOURCE} không trả về phim cho slug "${slug}"`);
    const movie = movieSummary(raw);
    if (!movie.slug) movie.slug = slug;
    return { movie, episodes: normalizeEpisodes(raw.episodes ?? data.episodes) };
  },

  /**
   * Tìm bản tương ứng của một phim đến từ nguồn khác: thử thẳng slug rồi tới tìm
   * theo tên/tên gốc. Slug của NguonC khác hệ (3/10 phim khớp VSMOV) nên đường
   * tìm theo tên mới là đường chính.
   */
  detailLike: async (wanted: { slug: string; name: string; originName?: string | null; year?: number | null }): Promise<SourceDetail | null> => {
    try {
      return await nguonc.detail(wanted.slug);
    } catch { /* slug khác hệ, chuyển sang tìm theo tên */ }
    for (const keyword of searchKeywords(wanted)) {
      const found = await listAt('/films/search', { page: 1, limit: 10 }, { keyword });
      const match = found.items.find((movie) => sameTitle(movie.name, movie.originName, wanted, movie.year));
      if (!match) continue;
      const detail = await nguonc.detail(match.slug);
      // Bản detail thiếu `year`, bản search thì có — bù lại để lưu vào DB đủ hơn.
      if (!detail.movie.year) detail.movie.year = match.year;
      return detail;
    }
    return null;
  }
};

/** Dùng trong test để bơm base URL giả mà không phải nạp lại module. */
export const nguoncBaseUrl = base;
