/**
 * Adapter TMDB — nguồn **metadata** chính thức (themoviedb.org).
 *
 * Vì sao thêm TMDB: catalog hiện tại phụ thuộc một nguồn duy nhất cho cả thứ nó
 * phát được lẫn thứ nó mô tả. Poster, điểm, mô tả, ảnh diễn viên đều đến từ đó,
 * nên nguồn chết là trang trắng. TMDB có API công khai, điều khoản cho phép dùng
 * đúng việc này, dữ liệu tiếng Việt sẵn có, và quan trọng nhất: nó không bao giờ
 * là nguồn phát, nên `kind: 'metadata'` — resolver biết không hỏi tập phim ở đây.
 *
 * Xác thực: đặt **một trong hai** biến môi trường.
 *   TMDB_ACCESS_TOKEN  token v4 (chuỗi JWT dài) → gửi ở header Authorization
 *   TMDB_API_KEY       khoá v3 (32 ký tự hex)   → gửi ở query ?api_key=
 * Không đặt gì thì `tmdbEnabled` là false và registry bỏ qua nguồn này.
 *
 * Slug: TMDB không có slug, chỉ có id số. Tổng hợp `ten-phim-m12345` (`m` = movie,
 * `t` = tv) rồi parse ngược ra id khi gọi `detail()`. Nhờ vậy slug vẫn khớp
 * `slugSchema` của server, vẫn đọc được bằng mắt, và vẫn quay về đúng bản ghi
 * TMDB mà không cần lưu bảng mapping.
 */
import { httpError } from '../errors.js';
import { slugifyName } from '../text.js';
import { getJson, queryString } from './http.js';
import { emptyMovie, imageUrl, makePagination, num, str } from './normalize.js';
import type {
  CatalogFilters, CatalogSource, ListPage, MovieSummary, SourceDetail, Taxonomy, TaxonomyItem
} from './types.js';

const SOURCE = 'tmdb';
const base = (process.env.TMDB_API_URL ?? 'https://api.themoviedb.org/3').replace(/\/$/, '');
const imageBase = (process.env.TMDB_IMAGE_BASE ?? 'https://image.tmdb.org/t/p').replace(/\/$/, '');
const language = process.env.TMDB_LANGUAGE ?? 'vi-VN';
const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim();
const apiKey = process.env.TMDB_API_KEY?.trim();

/** Registry hỏi cái này trước khi cắm nguồn vào — thiếu khoá thì bỏ qua, không nổ. */
export const tmdbEnabled = Boolean(accessToken || apiKey);

const ANIMATION_GENRE_ID = 16;
const PAGE_SIZE = 20;
const TMDB_MAX_PAGE = 500;

function request<T = any>(path: string, params: Record<string, unknown> = {}, ttlMs?: number): Promise<T> {
  const query = queryString({ language, ...params, ...(accessToken ? {} : { api_key: apiKey }) });
  return getJson<T>(`${base}${path}${query}`, {
    source: SOURCE,
    ttlMs,
    headers: accessToken ? { authorization: `Bearer ${accessToken}`, 'accept-language': language } : { 'accept-language': language }
  });
}

const poster = (path: unknown) => (typeof path === 'string' && path ? imageUrl(`${imageBase}/w500${path}`) : null);
const backdrop = (path: unknown) => (typeof path === 'string' && path ? imageUrl(`${imageBase}/w1280${path}`) : null);
const profile = (path: unknown) => (typeof path === 'string' && path ? imageUrl(`${imageBase}/w185${path}`) : null);

/** `ten-phim-m12345` ⇄ `{ kind: 'movie', id: 12345 }`. */
export function makeSlug(title: string, kind: 'movie' | 'tv', id: number) {
  const stem = slugifyName(title).slice(0, 100) || 'phim';
  return `${stem}-${kind === 'tv' ? 't' : 'm'}${id}`;
}

export function parseSlug(slug: string): { kind: 'movie' | 'tv'; id: number } | null {
  const matched = /-([mt])(\d{1,12})$/.exec(slug);
  if (!matched) return null;
  return { kind: matched[1] === 't' ? 'tv' : 'movie', id: Number(matched[2]) };
}

function statusOf(raw: unknown): string | null {
  switch (str(raw)) {
    case 'Returning Series': case 'In Production': return 'ongoing';
    case 'Ended': case 'Canceled': case 'Released': return 'completed';
    case 'Planned': case 'Post Production': case 'Rumored': return 'trailer';
    default: return null;
  }
}

function typeOf(kind: 'movie' | 'tv', genreIds: number[]): string {
  if (genreIds.includes(ANIMATION_GENRE_ID)) return 'hoathinh';
  return kind === 'tv' ? 'series' : 'single';
}

function yearOf(item: any): number | null {
  const date = str(item?.release_date) ?? str(item?.first_air_date);
  return date ? num(date.slice(0, 4)) : null;
}

/** Item của endpoint list/search (ít field hơn detail). */
function summary(item: any, forcedKind?: 'movie' | 'tv'): MovieSummary | null {
  const kind: 'movie' | 'tv' = forcedKind ?? (item?.media_type === 'tv' || item?.first_air_date ? 'tv' : 'movie');
  const id = Number(item?.id);
  const title = str(item?.title) ?? str(item?.name) ?? str(item?.original_title) ?? str(item?.original_name);
  if (!Number.isInteger(id) || id <= 0 || !title) return null;
  const genreIds: number[] = Array.isArray(item?.genre_ids) ? item.genre_ids.map(Number).filter(Number.isFinite) : [];
  return {
    ...emptyMovie(SOURCE, makeSlug(title, kind, id), title),
    providerId: String(id),
    originName: str(item?.original_title) ?? str(item?.original_name),
    description: str(item?.overview),
    type: typeOf(kind, genreIds),
    year: yearOf(item),
    language: str(item?.original_language),
    posterUrl: poster(item?.poster_path),
    thumbUrl: backdrop(item?.backdrop_path) ?? poster(item?.poster_path),
    rating: num(item?.vote_average),
    viewCount: 0,
    tmdbId: String(id),
    genres: genreIds.map((genreId) => genreNameById.get(genreId)).filter((name): name is string => Boolean(name))
  };
}

function listFrom(payload: any, forcedKind?: 'movie' | 'tv'): ListPage {
  const raw: any[] = Array.isArray(payload?.results) ? payload.results : [];
  const items = raw
    .filter((item) => !forcedKind ? item?.media_type !== 'person' : true)
    .map((item) => summary(item, forcedKind))
    .filter((item): item is MovieSummary => item !== null);
  return {
    items,
    pagination: makePagination({
      totalItems: payload?.total_results,
      totalPages: Math.min(Number(payload?.total_pages) || 1, TMDB_MAX_PAGE),
      currentPage: payload?.page,
      limit: PAGE_SIZE,
      itemCount: items.length
    })
  };
}

/**
 * TMDB đánh số thể loại, `byGenre('hanh-dong')` phải đổi slug về id. Nạp bảng thể
 * loại một lần rồi giữ lại; cả `summary()` cũng dùng nó để đổi `genre_ids` thành
 * tên, nên trang danh sách có thể loại ngay mà không phải gọi detail từng phim.
 */
const genreNameById = new Map<number, string>();
const genreIdBySlug = new Map<string, number>();
let genresLoadedAt = 0;

async function loadGenres() {
  if (genreNameById.size && Date.now() - genresLoadedAt < 24 * 3_600_000) return;
  const [movies, tv] = await Promise.all([
    request('/genre/movie/list', {}, 24 * 3_600_000),
    request('/genre/tv/list', {}, 24 * 3_600_000)
  ]);
  genreNameById.clear();
  genreIdBySlug.clear();
  for (const genre of [...(movies?.genres ?? []), ...(tv?.genres ?? [])]) {
    const id = Number(genre?.id);
    const name = str(genre?.name);
    if (!Number.isInteger(id) || !name) continue;
    genreNameById.set(id, name);
    // Thể loại trùng tên giữa movie/tv: giữ id đầu tiên, TMDB nhận nhiều id nên
    // lấy id nào cũng ra kết quả đúng thể loại đó.
    if (!genreIdBySlug.has(slugifyName(name))) genreIdBySlug.set(slugifyName(name), id);
  }
  genresLoadedAt = Date.now();
}

const countryNameByCode = new Map<string, string>();

async function loadCountries() {
  if (countryNameByCode.size) return;
  const rows = await request<any[]>('/configuration/countries', {}, 24 * 3_600_000);
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = str(row?.iso_3166_1);
    const name = str(row?.native_name) ?? str(row?.english_name);
    if (code && name) countryNameByCode.set(code.toUpperCase(), name);
  }
}

/** Slug danh sách mà web đang dùng → endpoint TMDB tương ứng. */
const LIST_ROUTES: Record<string, { path: string; kind?: 'movie' | 'tv'; params?: Record<string, unknown> }> = {
  'phim-moi-cap-nhat': { path: '/movie/now_playing', kind: 'movie' },
  'phim-moi': { path: '/movie/now_playing', kind: 'movie' },
  'phim-le': { path: '/discover/movie', kind: 'movie', params: { sort_by: 'popularity.desc' } },
  'phim-bo': { path: '/discover/tv', kind: 'tv', params: { sort_by: 'popularity.desc' } },
  'tv-shows': { path: '/discover/tv', kind: 'tv', params: { sort_by: 'first_air_date.desc' } },
  'hoat-hinh': { path: '/discover/movie', kind: 'movie', params: { with_genres: ANIMATION_GENRE_ID } },
  'phim-hot': { path: '/trending/all/week' },
  'phim-sap-chieu': { path: '/movie/upcoming', kind: 'movie' },
  'phim-danh-gia-cao': { path: '/movie/top_rated', kind: 'movie' }
};

/** TMDB phân trang 20 item/trang, không nhận `limit`; chuyển đổi để trang web vẫn hiểu. */
const tmdbPage = (filters: CatalogFilters) => Math.min(TMDB_MAX_PAGE, Math.max(1, Math.trunc(Number(filters.page) || 1)));

async function discover(kind: 'movie' | 'tv', params: Record<string, unknown>, filters: CatalogFilters) {
  await loadGenres();
  return listFrom(await request(`/discover/${kind}`, { ...params, page: tmdbPage(filters) }), kind);
}

export const tmdb: CatalogSource = {
  name: SOURCE,
  kind: 'metadata',

  latest: async (pageNumber, _limit) => {
    await loadGenres();
    return listFrom(await request('/movie/now_playing', { page: Math.min(TMDB_MAX_PAGE, Math.max(1, pageNumber)) }), 'movie');
  },

  home: async (filters = {}) => {
    await loadGenres();
    return listFrom(await request('/trending/all/week', { page: tmdbPage(filters) }));
  },

  list: async (slug, filters = {}) => {
    const route = LIST_ROUTES[slug];
    if (!route) throw httpError(404, `Nguồn ${SOURCE} không có danh sách "${slug}"`);
    await loadGenres();
    return listFrom(await request(route.path, { ...route.params, page: tmdbPage(filters) }), route.kind);
  },

  search: async (keyword, filters = {}) => {
    await loadGenres();
    return listFrom(await request('/search/multi', { query: keyword, page: tmdbPage(filters), include_adult: false }, 30_000));
  },

  genres: async (): Promise<Taxonomy> => {
    await loadGenres();
    const items: TaxonomyItem[] = [...genreIdBySlug.entries()].map(([slug, id]) => ({
      id: String(id), name: genreNameById.get(id) ?? slug, slug, thumbUrl: null
    }));
    return { items: items.sort((a, b) => a.name.localeCompare(b.name, 'vi')) };
  },

  byGenre: async (slug, filters = {}) => {
    await loadGenres();
    const id = genreIdBySlug.get(slug);
    if (!id) throw httpError(404, `Nguồn ${SOURCE} không có thể loại "${slug}"`);
    return discover('movie', { with_genres: id, sort_by: 'popularity.desc' }, filters);
  },

  countries: async (): Promise<Taxonomy> => {
    await loadCountries();
    // Danh sách đầy đủ của TMDB là ~250 mục, phần lớn không có phim — giới hạn ở
    // các nước thực sự sản xuất phim mà site này quan tâm, để menu còn dùng được.
    const wanted = ['VN', 'US', 'KR', 'CN', 'JP', 'TH', 'TW', 'HK', 'GB', 'FR', 'IN', 'PH', 'ES', 'DE', 'IT', 'RU', 'CA', 'AU'];
    return {
      items: wanted
        .filter((code) => countryNameByCode.has(code))
        .map((code) => ({ id: code, name: countryNameByCode.get(code)!, slug: code.toLowerCase(), thumbUrl: null }))
    };
  },

  byCountry: async (slug, filters = {}) => {
    const code = slug.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) throw httpError(404, `Nguồn ${SOURCE} nhận quốc gia theo mã ISO hai chữ, không phải "${slug}"`);
    return discover('movie', { with_origin_country: code, sort_by: 'popularity.desc' }, filters);
  },

  years: async (): Promise<Taxonomy> => {
    // TMDB không có endpoint "năm"; dựng 30 năm gần nhất, đúng thứ `byYear` nhận.
    const current = new Date().getFullYear();
    return {
      items: Array.from({ length: 30 }, (_, index) => {
        const year = String(current - index);
        return { id: year, name: year, slug: year, thumbUrl: null };
      })
    };
  },

  byYear: async (year, filters = {}) =>
    discover('movie', { primary_release_year: year, sort_by: 'popularity.desc' }, filters),

  actors: async (): Promise<Taxonomy> => {
    // Đây là lý do đáng giá nhất để cắm TMDB: ảnh diễn viên có bản quyền dùng
    // được, thay cho việc phụ thuộc nguồn phát cho từng cái avatar.
    const payload = await request('/person/popular', {}, 6 * 3_600_000);
    const rows: any[] = Array.isArray(payload?.results) ? payload.results : [];
    return {
      items: rows
        .map((row) => {
          const name = str(row?.name);
          return name ? { id: String(row?.id ?? name), name, slug: slugifyName(name), thumbUrl: profile(row?.profile_path) } : null;
        })
        .filter((item): item is TaxonomyItem => item !== null)
    };
  },

  detail: async (slug): Promise<SourceDetail> => {
    const parsed = parseSlug(slug);
    if (!parsed) throw httpError(404, `Slug "${slug}" không phải slug của ${SOURCE}`);
    await loadGenres();
    const item = await request(`/${parsed.kind}/${parsed.id}`, { append_to_response: 'credits,external_ids,videos' }, 6 * 3_600_000);
    const title = str(item?.title) ?? str(item?.name) ?? slug;
    const genreRows: any[] = Array.isArray(item?.genres) ? item.genres : [];
    const genreIds: number[] = genreRows.map((genre: any) => Number(genre?.id)).filter(Number.isFinite);
    const genres: string[] = genreRows
      .map((genre: any) => str(genre?.name))
      .filter((name: string | null): name is string => Boolean(name));
    const cast: any[] = Array.isArray(item?.credits?.cast) ? item.credits.cast : [];
    const crew: any[] = Array.isArray(item?.credits?.crew) ? item.credits.crew : [];
    const runtime = num(item?.runtime) ?? num(Array.isArray(item?.episode_run_time) ? item.episode_run_time[0] : null);
    const trailer = (Array.isArray(item?.videos?.results) ? item.videos.results : [])
      .find((video: any) => video?.site === 'YouTube' && (video?.type === 'Trailer' || video?.type === 'Teaser'));

    const movie: MovieSummary = {
      ...emptyMovie(SOURCE, slug, title),
      providerId: String(parsed.id),
      originName: str(item?.original_title) ?? str(item?.original_name),
      description: str(item?.overview),
      type: typeOf(parsed.kind, genreIds),
      status: statusOf(item?.status),
      year: yearOf(item),
      duration: runtime ? `${runtime} phút` : null,
      language: str(item?.original_language),
      posterUrl: poster(item?.poster_path),
      thumbUrl: backdrop(item?.backdrop_path) ?? poster(item?.poster_path),
      trailerUrl: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      rating: num(item?.vote_average),
      tmdbId: String(parsed.id),
      imdbId: str(item?.external_ids?.imdb_id),
      genres,
      countries: Array.isArray(item?.production_countries)
        ? item.production_countries.map((row: any) => str(row?.name)).filter((name: string | null): name is string => Boolean(name))
        : [],
      actors: cast.slice(0, 20).map((row) => str(row?.name)).filter((name): name is string => Boolean(name)),
      directors: crew
        .filter((row) => row?.job === 'Director' || row?.job === 'Series Director')
        .map((row) => str(row?.name))
        .filter((name): name is string => Boolean(name))
    };
    // Nguồn metadata không phát được: trả mảng tập rỗng thay vì đoán một link nào đó.
    return { movie, episodes: [] };
  }
};

/** Chỉ dùng trong test: bảng thể loại là state ở module. */
export function resetTmdbCaches() {
  genreNameById.clear();
  genreIdBySlug.clear();
  countryNameByCode.clear();
  genresLoadedAt = 0;
}
