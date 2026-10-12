/**
 * Gọi thẳng KKPhim (phimapi.com) từ trình duyệt — **nguồn chính để phát** sau khi
 * bỏ backend.
 *
 * Vì sao đứng đầu khi phát: KKPhim trả `link_m3u8` **thật** (và CORS `*` cả ở API
 * lẫn ở file m3u8), nên hls.js phát thẳng trong thẻ <video>, không cần iframe —
 * tránh hẳn embed `*.streamc.xyz` của NguonC đang bị Cloudflare chặn. VSMOV chỉ
 * còn phần chữ (m3u8 rỗng), NguonC thì chỉ có embed.
 *
 * Shape endpoint đối chiếu `services/api/src/providers/kkphim.ts`: nhóm cũ
 * (`/danh-sach/:slug`, `/tim-kiem`) để `items` ở gốc; nhóm `/v1/api/...` (lọc theo
 * thể loại/quốc gia/năm) bọc trong `data` và giấu phân trang ở `data.params.pagination`.
 * KKPhim không có endpoint liệt kê năm/diễn viên.
 */
import type { CatalogTarget } from './catalogFallback';
import type { IngestPayload, VsmovEpisodes } from './vsmov';
import type { Episode, Movie, MovieList, TaxonomyItem, TaxonomyList } from './types';
import { sameTitle, searchKeywords, type TitleHint } from './match';

const KKPHIM_API_URL = (import.meta.env.VITE_KKPHIM_API_URL ?? 'https://phimapi.com').replace(/\/$/, '');

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

/** Chuỗi đệm của nguồn ("Đang cập nhật", "N/A") không phải tên người/thể loại. */
const placeholder = (name: string) =>
  !/[\p{L}\p{N}]/u.test(name) || /^(dang cap nhat|chua cap nhat|chua ro|khong ro|n\/a|unknown|updating|none|null|undefined)$/.test(
    name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim()
  );

/** Nhận `['A','B']` hoặc `[{name:'A'}]` — hai dạng nguồn dùng lẫn nhau. */
const names = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item : str((item as { name?: unknown })?.name)))
        .filter((name): name is string => typeof name === 'string' && name.length > 0 && !placeholder(name))
    : [];

/** Payload KKPhim có lúc phẳng, có lúc bọc trong `data`. */
const unwrap = (payload: any) => payload?.data ?? payload ?? {};

async function getJson(path: string): Promise<any> {
  const response = await fetch(`${KKPHIM_API_URL}${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nguồn kkphim trả HTTP ${response.status}`);
  return response.json();
}

/** Thẻ phim từ payload KKPhim; `id: 0` vì id thật chỉ có trong kho (đã bỏ). */
function movieSummary(item: any): Movie | null {
  const slug = str(item?.slug);
  const name = str(item?.name) ?? str(item?.origin_name) ?? slug;
  if (!slug || !name) return null;
  return {
    id: 0,
    provider: 'kkphim',
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

/** Một mục danh mục: `slug` mới là thứ đi vào URL, `id` chỉ để React có khoá. */
function taxonomyItem(item: any): TaxonomyItem | null {
  const name = str(item?.name) ?? str(item?.slug);
  const slug = str(item?.slug) ?? str(item?.name);
  if (!name || !slug) return null;
  return { id: String(item?._id ?? item?.id ?? slug), name, slug, thumbUrl: imageUrl(item?.thumb_url) };
}

/**
 * Payload danh sách → `MovieList`. Nhóm `/v1/api/...` giấu phân trang trong
 * `data.params.pagination`; nhóm cũ để ở gốc.
 */
function listFromPayload(payload: any, limit: number): MovieList {
  const data = unwrap(payload);
  const rawItems: any[] = Array.isArray(data.items) ? data.items : Array.isArray(payload?.items) ? payload.items : [];
  const items = rawItems.map(movieSummary).filter((movie): movie is Movie => movie !== null);
  const p = data.params?.pagination ?? data.pagination ?? payload?.pagination ?? {};
  const perPage = Math.max(1, Math.trunc(Number(p.totalItemsPerPage) || Number(p.limit) || limit));
  const totalItems = Math.max(0, Math.trunc(Number(p.totalItems)) || items.length);
  const totalPages = Math.max(1, Math.trunc(Number(p.totalPages) || Math.ceil(totalItems / perPage) || 1));
  const currentPage = Math.min(totalPages, Math.max(1, Math.trunc(Number(p.currentPage) || 1)));
  return { items, pagination: { totalItems, totalPages, currentPage, totalItemsPerPage: perPage }, source: 'kkphim' };
}

/** Payload danh mục → `TaxonomyList`. */
function taxonomyFromPayload(payload: any): TaxonomyList {
  const data = unwrap(payload);
  const rawItems: any[] = Array.isArray(data.items) ? data.items : Array.isArray(payload?.items) ? payload.items : [];
  const items = rawItems.map(taxonomyItem).filter((item): item is TaxonomyItem => item !== null);
  return { items, source: 'kkphim' };
}

/** `movie.episodes[].server_data[]` → nhóm tập; KKPhim có `link_m3u8` thật. */
function episodesFromPayload(payload: any): VsmovEpisodes[] {
  const data = unwrap(payload);
  const groups: any[] = Array.isArray(data.episodes) ? data.episodes : Array.isArray(payload?.episodes) ? payload.episodes : [];
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
        .filter((entry: { link_embed: string; link_m3u8: string | null }) => entry.link_embed || entry.link_m3u8)
    }))
    .filter((group: VsmovEpisodes) => group.server_data.length);
}

/**
 * URL kiểu VSMOV (thứ `catalogTarget()` trả về) → đường của KKPhim. Danh mục lọc
 * theo giá trị nằm ở nhóm `/v1/api/...`; danh sách có sẵn ở `/danh-sach/:slug`.
 * Không dịch được thì trả `null` để chỗ gọi rơi sang nguồn khác.
 */
export function kkphimPath(url: string): string | null {
  const cut = url.indexOf('?');
  const path = (cut === -1 ? url : url.slice(0, cut)).replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  const query = cut === -1 ? '' : url.slice(cut);
  if (path === '/danh-sach/phim-moi-cap-nhat') return `/danh-sach/phim-moi-cap-nhat${query}`;
  const groups: [string, string][] = [
    ['/danh-sach/', '/danh-sach/'],
    ['/the-loai/', '/v1/api/the-loai/'],
    ['/quoc-gia/', '/v1/api/quoc-gia/'],
    ['/nam/', '/v1/api/nam/']
  ];
  for (const [from, to] of groups) if (path.startsWith(from)) return `${to}${path.slice(from.length)}${query}`;
  if (path === '/tim-kiem') return `/tim-kiem${query}`;
  return null;
}

/** Một trang danh sách theo đường đã dịch từ URL kiểu VSMOV. */
export async function kkphimList(path: string, limit = 24): Promise<MovieList> {
  return listFromPayload(await getJson(path), limit);
}

/** Tìm kiếm: `/tim-kiem?keyword=`. */
export async function kkphimSearch(keyword: string, page = 1, limit = 24): Promise<MovieList> {
  const search = new URLSearchParams({ keyword, page: String(page), limit: String(limit) });
  return listFromPayload(await getJson(`/tim-kiem?${search}`), limit);
}

/** Chi tiết một phim: metadata + nhóm tập có m3u8 thật. */
export async function kkphimDetail(slug: string): Promise<IngestPayload> {
  const payload = await getJson(`/phim/${encodeURIComponent(slug)}`);
  const data = unwrap(payload);
  const raw = data.movie ?? payload?.movie;
  const movie = raw && movieSummary(raw);
  if (!movie) throw new Error(`Nguồn kkphim không trả về phim cho slug "${slug}"`);
  if (!movie.slug) movie.slug = slug;
  return { movie, episodes: episodesFromPayload(payload) };
}

/**
 * Nhóm tập KKPhim → `Episode[]` với id âm — đủ để bấm xem, không đụng id thật.
 * Giữ cả `m3u8Url` thật để `Watch` phát thẳng qua hls.js.
 */
export function episodesFromKkphim(groups: VsmovEpisodes[]): Episode[] {
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

/** Danh mục: KKPhim chỉ có thể loại/quốc gia; năm/diễn viên trả rỗng. */
export async function kkphimTaxonomy(path: string): Promise<TaxonomyList> {
  const clean = path.replace(/\/+$/, '');
  if (clean === '/the-loai' || clean === '/quoc-gia') return taxonomyFromPayload(await getJson(clean));
  return { items: [], source: 'kkphim' };
}

/**
 * Tìm bản tương ứng của một phim đến từ nguồn khác: thử thẳng `/phim/:slug`, không
 * có thì tìm theo tên rồi mới lấy chi tiết. Dùng cho `sources.ts` khi đổi nguồn.
 */
export async function kkphimDetailLike(wanted: TitleHint): Promise<IngestPayload | null> {
  if (wanted.slug) {
    try { return await kkphimDetail(wanted.slug); } catch { /* slug khác hệ, tìm theo tên */ }
  }
  for (const keyword of searchKeywords(wanted)) {
    const found = await kkphimSearch(keyword, 1, 10).catch(() => null);
    const match = found?.items.find((item) => sameTitle(item.name, item.originName, wanted, item.year));
    if (match?.slug) return kkphimDetail(match.slug);
  }
  return null;
}

/**
 * Chạy một `CatalogTarget` bằng KKPhim, trả về **đúng shape API** cho route đó.
 * Ném lỗi khi KKPhim không có đường tương ứng — `sources.ts` bắt lấy rồi thử nguồn kế.
 */
export async function kkphimTarget(target: CatalogTarget): Promise<unknown> {
  if (target.kind === 'navigation') {
    const [genres, countries] = await Promise.all([kkphimTaxonomy('/the-loai'), kkphimTaxonomy('/quoc-gia')]);
    return { genres: genres.items, countries: countries.items, years: [] };
  }
  if (target.kind === 'taxonomy') return kkphimTaxonomy(target.url);
  if (target.kind === 'detail') {
    const detail = await kkphimDetail(target.slug);
    return { movie: { ...detail.movie, episodes: episodesFromKkphim(detail.episodes) } };
  }
  const path = kkphimPath(target.url);
  if (!path) throw new Error(`KKPhim không có đường "${target.url}"`);
  return kkphimList(path, target.limit);
}



