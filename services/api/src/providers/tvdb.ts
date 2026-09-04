/**
 * Adapter TheTVDB v4 — nguồn **metadata** thứ hai (api4.thetvdb.com).
 *
 * Vì sao thêm TVDB khi đã có TMDB: TMDB mạnh ở phim lẻ phương Tây, còn phim bộ
 * châu Á thì thứ tự tập, tên mùa và ngày phát sóng của TVDB đúng hơn — đúng chỗ
 * site này cần. Hai nguồn metadata cũng là hai đường lùi cho nhau: nguồn nào chết
 * thì poster/mô tả vẫn còn nguồn kia.
 *
 * Xác thực khác TMDB: TVDB không nhận khoá ở mỗi request. Phải `POST /login` với
 * `TVDB_API_KEY` (kèm `TVDB_PIN` nếu là khoá user-supported) để lấy bearer token,
 * token sống khoảng một tháng. Ở đây token được giữ trong module, làm mới sau
 * `TOKEN_TTL_MS`, và nếu nguồn trả 401 giữa đường thì bỏ token rồi thử lại **một**
 * lần — token hết hạn sớm là chuyện có thật, nhưng lặp vô hạn thì không.
 *
 * Slug: TVDB cũng chỉ có id số. Tổng hợp `ten-phim-v12345s` / `ten-phim-v12345f`
 * (`s` = series, `f` = film) — hậu tố cố tình khác `-m###`/`-t###` của TMDB để
 * `parseSlug` của hai nguồn không bao giờ nhận nhầm slug của nhau.
 *
 * Chưa kiểm chứng được bằng request thật (sandbox không có mạng, cũng chưa có
 * khoá), nên mọi field đều đọc qua `str()`/`num()` và thử nhiều cách viết tên:
 * endpoint `/search` của TVDB trả snake_case còn `/series/{id}/extended` trả
 * camelCase. Sai shape thì `checkList`/`checkDetail` ném và resolver rơi xuống
 * nguồn sau, không có gì vỡ ngoài việc thiếu metadata.
 */
import { httpError } from '../errors.js';
import { slugifyName } from '../text.js';
import { getJson, postJson, queryString, upstreamStatus } from './http.js';
import { emptyMovie, imageUrl, makePagination, num, str } from './normalize.js';
import type {
  CatalogFilters, CatalogSource, ListPage, MovieSummary, SourceDetail, Taxonomy, TaxonomyItem
} from './types.js';

const SOURCE = 'tvdb';
const base = (process.env.TVDB_API_URL ?? 'https://api4.thetvdb.com/v4').replace(/\/$/, '');
const apiKey = process.env.TVDB_API_KEY?.trim();
const pin = process.env.TVDB_PIN?.trim();
/** Mã ngôn ngữ của TVDB là ISO 639-2/B ba chữ: `vie`, `eng`, `kor`... */
const language = (process.env.TVDB_LANGUAGE ?? 'vie').trim().toLowerCase();
const fallbackLanguage = 'eng';
/**
 * `/series/filter` và `/movies/filter` **bắt buộc** có `country` + `lang`, nên
 * phải chọn sẵn. Mặc định là ba nước mà site này quan tâm nhất; trang danh sách
 * gộp kết quả của cả ba thay vì ép một nước.
 */
const countries = (process.env.TVDB_COUNTRIES ?? 'chn,kor,jpn').split(',').map((code) => code.trim().toLowerCase()).filter(Boolean);

/** Registry hỏi cái này trước khi cắm nguồn vào — thiếu khoá thì bỏ qua, không nổ. */
export const tvdbEnabled = Boolean(apiKey);

const PAGE_SIZE = 20;
const TOKEN_TTL_MS = 24 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

type Kind = 'series' | 'movie';

let token: { value: string; expires: number } | null = null;
let pending: Promise<string> | null = null;

/** Một lần đăng nhập cho mọi request đang chờ, không phải mỗi request một lần. */
async function login(): Promise<string> {
  if (!apiKey) throw httpError(500, `Nguồn ${SOURCE} chưa có TVDB_API_KEY`);
  const payload = await postJson<any>(`${base}/login`, pin ? { apikey: apiKey, pin } : { apikey: apiKey }, { source: SOURCE });
  const value = str(payload?.data?.token) ?? str(payload?.token);
  if (!value) throw httpError(502, `Nguồn ${SOURCE} đăng nhập được nhưng không trả token`);
  token = { value, expires: Date.now() + TOKEN_TTL_MS };
  return value;
}

function authorize(): Promise<string> {
  if (token && token.expires > Date.now()) return Promise.resolve(token.value);
  pending ??= login().finally(() => { pending = null; });
  return pending;
}

/**
 * GET có kèm bearer token. `retry` để chỉ thử lại đúng một lần khi token hết hạn
 * sớm — TVDB trả 401 cho cả "token hết hạn" và "khoá sai", và cách phân biệt duy
 * nhất là xin token mới xem có đỡ không.
 */
async function request<T = any>(path: string, params: Record<string, unknown> = {}, ttlMs?: number, retry = true): Promise<T> {
  const bearer = await authorize();
  try {
    return await getJson<T>(`${base}${path}${queryString(params)}`, {
      source: SOURCE,
      ttlMs,
      headers: { authorization: `Bearer ${bearer}`, 'accept-language': language }
    });
  } catch (error) {
    if (!retry || upstreamStatus(error) !== 401) throw error;
    token = null;
    return request<T>(path, params, ttlMs, false);
  }
}

/** `ten-phim-v12345s` ⇄ `{ kind: 'series', id: 12345 }`. */
export function makeSlug(title: string, kind: Kind, id: number) {
  const stem = slugifyName(title).slice(0, 100) || 'phim';
  return `${stem}-v${id}${kind === 'series' ? 's' : 'f'}`;
}

export function parseSlug(slug: string): { kind: Kind; id: number } | null {
  const matched = /-v(\d{1,12})([sf])$/.exec(slug);
  if (!matched) return null;
  return { kind: matched[2] === 's' ? 'series' : 'movie', id: Number(matched[1]) };
}

/** Nhiều endpoint của TVDB đặt tên field khác nhau cho cùng một thứ. */
function pick(item: any, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = str(item?.[key]);
    if (value) return value;
  }
  return null;
}

function pickNumber(item: any, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = num(item?.[key]);
    if (value !== null) return value;
  }
  return null;
}

/** `id` của record tìm kiếm là `"series-72108"`; `tvdb_id` là `"72108"`. */
function idOf(item: any): number | null {
  const direct = pickNumber(item, 'tvdb_id', 'tvdbId', 'id');
  if (direct !== null) return direct;
  const matched = /(\d+)\s*$/.exec(String(item?.id ?? item?.objectID ?? ''));
  return matched ? Number(matched[1]) : null;
}

function kindOf(item: any, forced?: Kind): Kind {
  if (forced) return forced;
  const raw = (pick(item, 'type', 'recordType', 'objectType') ?? '').toLowerCase();
  if (raw.includes('movie') || raw.includes('film')) return 'movie';
  if (raw.includes('series')) return 'series';
  return String(item?.id ?? item?.objectID ?? '').startsWith('movie') ? 'movie' : 'series';
}

/** Bản dịch theo `TVDB_LANGUAGE`, không có thì tiếng Anh, không có nữa thì field gốc. */
function translated(item: any, field: 'translations' | 'overviews', fallback: string | null): string | null {
  const table = item?.[field];
  if (table && typeof table === 'object' && !Array.isArray(table)) {
    const value = str(table[language]) ?? str(table[fallbackLanguage]);
    if (value) return value;
  }
  return fallback;
}

/**
 * `/series/{id}/extended?meta=translations` trả `translations.nameTranslations`
 * dạng mảng `[{ language, name, overview }]` — khác hẳn dạng object của `/search`.
 */
function fromTranslationList(item: any, field: 'name' | 'overview'): string | null {
  const groups = [item?.translations?.nameTranslations, item?.translations?.overviewTranslations];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const wanted of [language, fallbackLanguage]) {
      const row = group.find((entry: any) => str(entry?.language) === wanted);
      const value = str(row?.[field]);
      if (value) return value;
    }
  }
  return null;
}

function yearOf(item: any): number | null {
  const direct = pickNumber(item, 'year');
  if (direct) return direct;
  const date = pick(item, 'first_air_time', 'firstAired', 'firstAirTime', 'released', 'releaseDate');
  return date ? num(date.slice(0, 4)) : null;
}

function statusOf(item: any): string | null {
  const raw = (str(item?.status?.name) ?? pick(item, 'status') ?? '').toLowerCase();
  if (!raw) return null;
  if (raw.includes('continuing') || raw.includes('upcoming released')) return 'ongoing';
  if (raw.includes('ended') || raw.includes('released')) return 'completed';
  if (raw.includes('announced') || raw.includes('planned') || raw.includes('upcoming')) return 'trailer';
  return null;
}

function typeOf(kind: Kind, genres: string[]): string {
  if (genres.some((genre) => /animation|anime|hoạt hình/i.test(genre))) return 'hoathinh';
  return kind === 'series' ? 'series' : 'single';
}

function genreNames(item: any): string[] {
  const raw = item?.genres;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry: any) => (typeof entry === 'string' ? str(entry) : str(entry?.name)))
    .filter((name): name is string => Boolean(name));
}

/** Item của `/search` (ít field hơn `/extended`, và viết snake_case). */
function summary(item: any, forced?: Kind): MovieSummary | null {
  const id = idOf(item);
  const kind = kindOf(item, forced);
  const name = translated(item, 'translations', pick(item, 'name', 'seriesName', 'translatedName'));
  if (!id || !name) return null;
  const genres = genreNames(item);
  return {
    ...emptyMovie(SOURCE, makeSlug(name, kind, id), name),
    providerId: String(id),
    originName: pick(item, 'original_name', 'originalName'),
    description: translated(item, 'overviews', pick(item, 'overview', 'description')),
    type: typeOf(kind, genres),
    status: statusOf(item),
    year: yearOf(item),
    language: pick(item, 'primary_language', 'primaryLanguage', 'originalLanguage'),
    posterUrl: imageUrl(pick(item, 'image_url', 'image', 'poster', 'thumbnail')),
    thumbUrl: imageUrl(pick(item, 'thumbnail', 'image_url', 'image')),
    genres,
    countries: [pick(item, 'country', 'originalCountry')].filter((value): value is string => Boolean(value))
  };
}

/**
 * Ghi chú về `rating`: `score` của TVDB là điểm phổ biến (hàng nghìn), không phải
 * thang 10 như TMDB. Đưa nguyên vào field `rating` thì trang chi tiết hiện "score
 * 218743/10", mà không có công thức chính thức nào để quy đổi. Nên adapter này
 * **không** ghi `rating`: để `enrich()` lấy từ TMDB, TVDB chỉ giữ những gì nó nói
 * đúng (thứ tự tập, ngày phát sóng, tên mùa).
 */
function listFrom(payload: any, page: number, forced?: Kind): ListPage {
  const raw: any[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const items = raw
    .map((item) => summary(item, forced))
    .filter((item): item is MovieSummary => item !== null);
  const links = payload?.links ?? {};
  const totalItems = pickNumber(links, 'total_items', 'totalItems');
  return {
    items,
    pagination: makePagination({
      totalItems: totalItems ?? items.length,
      // TVDB chỉ cho biết có trang sau hay không, không cho tổng số trang.
      totalPages: totalItems ? Math.ceil(totalItems / PAGE_SIZE) : (links?.next ? page + 1 : page),
      currentPage: page,
      limit: PAGE_SIZE,
      itemCount: items.length
    })
  };
}

const pageOf = (filters: CatalogFilters) => Math.max(1, Math.trunc(Number(filters.page) || 1));

/** Bảng thể loại: filter nhận id số, còn web đưa slug. */
const genreIdBySlug = new Map<string, number>();
const genreNameBySlug = new Map<string, string>();
let genresLoadedAt = 0;

async function loadGenres() {
  if (genreIdBySlug.size && Date.now() - genresLoadedAt < DAY_MS) return;
  const payload = await request('/genres', {}, DAY_MS);
  const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
  genreIdBySlug.clear();
  genreNameBySlug.clear();
  for (const row of rows) {
    const id = num(row?.id);
    const name = str(row?.name);
    if (!id || !name) continue;
    const slug = str(row?.slug) ?? slugifyName(name);
    genreIdBySlug.set(slug, id);
    genreNameBySlug.set(slug, name);
  }
  genresLoadedAt = Date.now();
}

/**
 * Gộp kết quả filter của nhiều nước thành một trang. Filter của TVDB chỉ nhận một
 * nước mỗi lần, mà site này quan tâm cả Trung/Hàn/Nhật — ép một nước thì trang
 * danh sách mất hai phần ba nội dung đáng xem.
 */
async function filterMany(kind: Kind, params: Record<string, unknown>, filters: CatalogFilters, ttlMs = 10 * 60_000): Promise<ListPage> {
  const page = pageOf(filters);
  const path = kind === 'series' ? '/series/filter' : '/movies/filter';
  const results = await Promise.allSettled(countries.map((country) => request(
    path,
    { country, lang: language, page: page - 1, ...params },
    ttlMs
  )));
  const merged: MovieSummary[] = [];
  const seen = new Set<string>();
  let failures = 0;
  for (const result of results) {
    if (result.status === 'rejected') { failures += 1; continue; }
    for (const item of listFrom(result.value, page, kind).items) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      merged.push(item);
    }
  }
  // Mọi nước đều lỗi mới coi là nguồn lỗi; một nước lỗi thì trang vẫn có nội dung.
  if (failures === results.length) {
    const first = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
    throw first?.reason ?? httpError(502, `Nguồn ${SOURCE} không trả lời cho ${path}`);
  }
  return {
    items: merged,
    pagination: makePagination({
      totalItems: merged.length,
      totalPages: merged.length < countries.length ? page : page + 1,
      currentPage: page,
      limit: Math.max(PAGE_SIZE, merged.length),
      itemCount: merged.length
    })
  };
}

/** Slug danh sách của web → cách gọi TVDB tương ứng. */
const LIST_ROUTES: Record<string, { kind: Kind; sort?: string; genre?: string }> = {
  'phim-moi-cap-nhat': { kind: 'series', sort: 'firstAired' },
  'phim-moi': { kind: 'movie', sort: 'firstAired' },
  'phim-le': { kind: 'movie', sort: 'score' },
  'phim-bo': { kind: 'series', sort: 'score' },
  'tv-shows': { kind: 'series', sort: 'firstAired' },
  'hoat-hinh': { kind: 'series', sort: 'score', genre: 'animation' },
  'phim-hot': { kind: 'series', sort: 'score' },
  'phim-sap-chieu': { kind: 'movie', sort: 'firstAired' },
  'phim-danh-gia-cao': { kind: 'movie', sort: 'score' }
};

async function detailOf(kind: Kind, id: number, slug: string): Promise<SourceDetail> {
  const payload = await request(`/${kind === 'series' ? 'series' : 'movies'}/${id}/extended`, { meta: 'translations' }, 6 * 3_600_000);
  const item = payload?.data ?? payload;
  const name = fromTranslationList(item, 'name') ?? pick(item, 'name', 'seriesName') ?? slug;
  const genres = genreNames(item);
  const characters: any[] = Array.isArray(item?.characters) ? item.characters : [];
  const remote: any[] = Array.isArray(item?.remoteIds) ? item.remoteIds : [];
  const runtime = pickNumber(item, 'averageRuntime', 'runtime');
  const trailer = (Array.isArray(item?.trailers) ? item.trailers : [])
    .find((entry: any) => str(entry?.url)) ?? null;
  const remoteId = (pattern: RegExp) => {
    const row = remote.find((entry: any) => pattern.test(str(entry?.sourceName) ?? ''));
    return str(row?.id);
  };

  const movie: MovieSummary = {
    ...emptyMovie(SOURCE, slug, name),
    providerId: String(id),
    originName: pick(item, 'originalName', 'name'),
    description: fromTranslationList(item, 'overview') ?? pick(item, 'overview'),
    type: typeOf(kind, genres),
    status: statusOf(item),
    year: yearOf(item),
    duration: runtime ? `${runtime} phút` : null,
    language: pick(item, 'originalLanguage', 'primaryLanguage'),
    posterUrl: imageUrl(pick(item, 'image', 'poster')),
    thumbUrl: imageUrl(pick(item, 'image')),
    trailerUrl: imageUrl(str(trailer?.url)),
    tmdbId: remoteId(/tmdb|themoviedb/i),
    imdbId: remoteId(/imdb/i),
    genres,
    countries: [pick(item, 'originalCountry', 'country')].filter((value): value is string => Boolean(value)),
    actors: characters
      .filter((entry: any) => !/director|writer|crew/i.test(str(entry?.peopleType) ?? ''))
      .slice(0, 20)
      .map((entry: any) => pick(entry, 'personName', 'peopleName', 'name'))
      .filter((value): value is string => Boolean(value)),
    directors: characters
      .filter((entry: any) => /director/i.test(str(entry?.peopleType) ?? ''))
      .map((entry: any) => pick(entry, 'personName', 'peopleName', 'name'))
      .filter((value): value is string => Boolean(value))
  };
  // Nguồn metadata: TVDB có danh sách tập nhưng không có link phát, và trả một mảng
  // tập rỗng-link vào đây thì player sẽ thấy tập rồi bấm vào không có gì.
  return { movie, episodes: [] };
}

export const tvdb: CatalogSource = {
  name: SOURCE,
  kind: 'metadata',

  latest: async (page) => filterMany('series', { sort: 'firstAired', sortType: 'desc' }, { page }),

  home: async (filters = {}) => filterMany('series', { sort: 'score', sortType: 'desc' }, filters),

  list: async (slug, filters = {}) => {
    const route = LIST_ROUTES[slug];
    if (!route) throw httpError(404, `Nguồn ${SOURCE} không có danh sách "${slug}"`);
    const params: Record<string, unknown> = { sort: route.sort ?? 'score', sortType: 'desc' };
    if (route.genre) {
      await loadGenres();
      const id = genreIdBySlug.get(route.genre);
      if (id) params.genre = id;
    }
    return filterMany(route.kind, params, filters);
  },

  search: async (keyword, filters = {}) => {
    const page = pageOf(filters);
    const payload = await request('/search', {
      query: keyword,
      limit: PAGE_SIZE,
      // Search của TVDB đánh trang từ 0, khác phần còn lại của API này.
      page: page - 1
    }, 30_000);
    return listFrom(payload, page);
  },

  genres: async (): Promise<Taxonomy> => {
    await loadGenres();
    const items: TaxonomyItem[] = [...genreIdBySlug.keys()].map((slug) => ({
      id: String(genreIdBySlug.get(slug)), name: genreNameBySlug.get(slug) ?? slug, slug, thumbUrl: null
    }));
    return { items: items.sort((a, b) => a.name.localeCompare(b.name, 'vi')) };
  },

  byGenre: async (slug, filters = {}) => {
    await loadGenres();
    const id = genreIdBySlug.get(slug);
    if (!id) throw httpError(404, `Nguồn ${SOURCE} không có thể loại "${slug}"`);
    return filterMany('series', { genre: id, sort: 'score', sortType: 'desc' }, filters);
  },

  countries: async (): Promise<Taxonomy> => {
    const payload = await request('/countries', {}, DAY_MS);
    const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
    const items = rows
      .map((row): TaxonomyItem | null => {
        const code = str(row?.id) ?? str(row?.shortCode);
        const name = str(row?.name);
        return code && name ? { id: code, name, slug: code.toLowerCase(), thumbUrl: null } : null;
      })
      .filter((item): item is TaxonomyItem => item !== null);
    return { items };
  },

  byCountry: async (slug, filters = {}) => {
    const code = slug.trim().toLowerCase();
    // Filter của TVDB nhận mã ba chữ (`kor`, `chn`, `jpn`); slug của nguồn khác
    // (`han-quoc`, `kr`) không phải mã đó, và đoán bừa thì trả về phim của nước khác.
    if (!/^[a-z]{3}$/.test(code)) throw httpError(404, `Nguồn ${SOURCE} nhận quốc gia theo mã ba chữ, không phải "${slug}"`);
    const page = pageOf(filters);
    return listFrom(await request('/series/filter', { country: code, lang: language, sort: 'score', sortType: 'desc', page: page - 1 }, 10 * 60_000), page, 'series');
  },

  years: async (): Promise<Taxonomy> => {
    const current = new Date().getFullYear();
    return {
      items: Array.from({ length: 30 }, (_, index) => {
        const year = String(current - index);
        return { id: year, name: year, slug: year, thumbUrl: null };
      })
    };
  },

  byYear: async (year, filters = {}) => filterMany('series', { year, sort: 'score', sortType: 'desc' }, filters),

  detail: async (slug): Promise<SourceDetail> => {
    const parsed = parseSlug(slug);
    if (!parsed) throw httpError(404, `Slug "${slug}" không phải slug của ${SOURCE}`);
    return detailOf(parsed.kind, parsed.id, slug);
  }
};

/** Chỉ dùng trong test: token và bảng thể loại là state ở module. */
export function resetTvdbCaches() {
  token = null;
  pending = null;
  genreIdBySlug.clear();
  genreNameBySlug.clear();
  genresLoadedAt = 0;
}
