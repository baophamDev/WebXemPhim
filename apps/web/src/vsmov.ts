/**
 * Gọi thẳng VSMOV từ trình duyệt.
 *
 * VSMOV chặn 403 các IP datacenter (server API trên Railway) nhưng cho IP nhà,
 * và nguồn trả `Access-Control-Allow-Origin: *` nên browser gọi được luôn. Đây
 * là đường lấy dữ liệu chính cho tìm kiếm và trang chi tiết; kho DB của API
 * được lấp bằng `ingest` sau mỗi lần browser kéo được một phim.
 *
 * Cũng chính vì nguồn gọi được từ trình duyệt mà khi **API** chết (service bị
 * xoá, hết credit, Vercel không proxy `/api`), catalog vẫn còn đường sống:
 * `vsmovList`/`vsmovTaxonomy`/`vsmovTarget` trả về đúng shape mà API mình trả,
 * để `api.ts` (qua `catalogFallback.ts`) nhặt lại mà không chỗ gọi nào biết.
 */
import type { CatalogTarget } from './catalogFallback';
import type { Episode, Movie, MovieList, TaxonomyItem, TaxonomyList } from './types';

const VSMOV_API_URL = (import.meta.env.VITE_VSMOV_API_URL ?? 'https://vsmov.com/api').replace(/\/$/, '');

const str = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
};

const imageUrl = (value: unknown): string | null => {
  const raw = str(value);
  return raw && /^https?:\/\//i.test(raw) ? raw : null;
};

/** Nhận `['A','B']` hoặc `[{name:'A'}]` — hai dạng vsmov dùng lẫn nhau. */
const names = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item : str((item as { name?: unknown })?.name)))
        .filter((name): name is string => Boolean(name))
    : [];

/** Payload của nguồn có lúc phẳng, có lúc bọc trong `data`. */
const unwrap = (payload: any) => payload?.data ?? payload ?? {};

/**
 * Thẻ phim từ danh sách: đủ để vẽ card, poster, trang chi tiết tạm. `id: 0` vì
 * id trong kho mới thật (đi qua ingest); các nút cần id (Lưu phim) chỉ hiện khi
 * có bản trong kho.
 */
function movieSummary(item: any): Movie | null {
  const slug = str(item?.slug);
  const name = str(item?.name) ?? str(item?.origin_name) ?? slug;
  if (!slug || !name) return null;
  return {
    id: 0,
    provider: 'vsmov',
    providerId: item?._id == null ? null : String(item._id),
    slug, name,
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

/** Một mục danh mục: `id` chỉ để React có khoá, `slug` mới là thứ đi vào URL. */
function taxonomyItem(item: any): TaxonomyItem | null {
  const name = str(item?.name) ?? str(item?.slug);
  const slug = str(item?.slug) ?? str(item?.name);
  if (!name || !slug) return null;
  return { id: String(item?._id ?? item?.id ?? slug), name, slug, thumbUrl: imageUrl(item?.thumb_url) };
}

export interface VsmovEpisodes {
  server_name: string;
  server_data: { name: string; filename: string | null; link_embed: string; link_m3u8: string | null }[];
}

/** Body gửi lên `POST /api/ingest/movies` — đúng shape `upsertMovie` đọc được. */
export interface IngestPayload {
  movie: Omit<Movie, 'id'>;
  episodes: VsmovEpisodes[];
}

async function getJson(path: string): Promise<any> {
  const response = await fetch(`${VSMOV_API_URL}${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nguồn vsmov trả HTTP ${response.status}`);
  return response.json();
}

/** `?a=1&b=2`, bỏ tham số rỗng và `undefined` — `type=` là một giá trị lạ với nguồn. */
function querySuffix(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) search.set(key, text);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/**
 * Payload danh sách → `MovieList`. Nguồn không trả phân trang (một số endpoint
 * bỏ qua `page`) thì lấy số mục vừa nhận làm tổng, và luôn trả `totalPages >= 1`
 * để chỗ gọi không phải chia cho 0.
 */
function listFromPayload(payload: unknown, limit: number): MovieList {
  const data = unwrap(payload);
  const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
  const items = rawItems.map(movieSummary).filter((movie): movie is Movie => movie !== null);
  const p = data.pagination ?? {};
  const perPage = Math.max(1, Math.trunc(Number(p.totalItemsPerPage) || Number(p.limit) || limit));
  const totalItems = Math.max(0, Math.trunc(Number(p.totalItems)) || items.length);
  const totalPages = Math.max(1, Math.trunc(Number(p.totalPages) || Math.ceil(totalItems / perPage) || 1));
  const currentPage = Math.min(totalPages, Math.max(1, Math.trunc(Number(p.currentPage) || 1)));
  return { items, pagination: { totalItems, totalPages, currentPage, totalItemsPerPage: perPage }, source: 'vsmov' };
}

/** Payload danh mục → `TaxonomyList`. Không có `slug` thì mục đó không bấm được. */
function taxonomyFromPayload(payload: unknown): TaxonomyList {
  const data = unwrap(payload);
  const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
  const items = rawItems.map(taxonomyItem).filter((item): item is TaxonomyItem => item !== null);
  return { items, source: 'vsmov' };
}

/** Một trang danh sách: `/danh-sach/:slug`, `/the-loai/:slug`, `/quoc-gia/:slug`... */
export async function vsmovList(
  path: string,
  params: Record<string, string | number | undefined | null> = {},
  limit = 24
): Promise<MovieList> {
  return listFromPayload(await getJson(`${path}${querySuffix(params)}`), limit);
}

/** Một danh mục đầy đủ, không phân trang: `/the-loai`, `/quoc-gia`, `/nam`, `/code`. */
export async function vsmovTaxonomy(path: string): Promise<TaxonomyList> {
  return taxonomyFromPayload(await getJson(path));
}

/** Tìm kiếm: `/tim-kiem?keyword=`. Từ khoá tối thiểu 2 ký tự theo luật của nguồn. */
export async function vsmovSearch(keyword: string, page = 1, limit = 24): Promise<MovieList> {
  return vsmovList('/tim-kiem', { keyword, page, limit }, limit);
}

/** Chi tiết một phim: dữ liệu đầy đủ (diễn viên, mô tả) + nhóm tập theo server. */
export async function vsmovDetail(slug: string): Promise<IngestPayload> {
  const payload = await getJson(`/phim/${encodeURIComponent(slug)}`);
  const data = unwrap(payload);
  const raw = data.movie ?? payload?.movie;
  const movie = raw && movieSummary(raw);
  if (!movie) throw new Error(`Nguồn vsmov không trả về phim cho slug "${slug}"`);
  // Nguồn thỉnh thoảng trả `slug` rỗng ở bản detail; giữ slug người dùng đã hỏi.
  if (!movie.slug) movie.slug = slug;
  const episodes: VsmovEpisodes[] = (Array.isArray(data.episodes) ? data.episodes : [])
    .map((group: any) => ({
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
    .filter((group: VsmovEpisodes) => group.server_data.length);
  return { movie, episodes };
}

/**
 * Nhóm tập từ vsmov (chưa có id trong kho) đổi sang `Episode[]` với id âm —
 * đủ để bấm xem (`Watch` dùng link phát chứ không truy vấn id khi có state),
 * và không đụng id thật của kho khi ingest xong.
 */
export function episodesFromVsmov(groups: VsmovEpisodes[]): Episode[] {
  const episodes: Episode[] = [];
  for (const group of groups) {
    for (const entry of group.server_data) {
      const number = Number.parseInt(String(entry.name ?? '').replace(/\D/g, ''), 10);
      episodes.push({
        id: -(episodes.length + 1), movieId: 0, serverName: group.server_name,
        name: entry.name, episodeNumber: Number.isFinite(number) ? number : null,
        embedUrl: entry.link_embed, m3u8Url: entry.link_m3u8
      });
    }
  }
  return episodes;
}

/**
 * Chạy một `CatalogTarget` (`catalogFallback.ts`) và trả về **đúng shape mà API
 * mình trả** cho route đó — nhờ vậy chỗ gọi không cần biết dữ liệu vừa rồi đến
 * từ API hay từ nguồn. Lỗi thì để nguyên cho `api.ts` quyết định.
 */
export async function vsmovTarget(target: CatalogTarget): Promise<unknown> {
  if (target.kind === 'navigation') {
    const [genres, countries, years] = await Promise.all([
      vsmovTaxonomy('/the-loai'), vsmovTaxonomy('/quoc-gia'), vsmovTaxonomy('/nam')
    ]);
    return { genres: genres.items, countries: countries.items, years: years.items };
  }
  if (target.kind === 'taxonomy') return vsmovTaxonomy(target.url);
  if (target.kind === 'detail') {
    const detail = await vsmovDetail(target.slug);
    return { movie: { ...detail.movie, episodes: episodesFromVsmov(detail.episodes) } };
  }
  return vsmovList(target.url, {}, target.limit);
}
