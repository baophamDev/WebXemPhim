/**
 * Dịch VSMOV ↔ NguonC ở phía trình duyệt: URL mà `catalogFallback.ts` trả về
 * (đang theo hệ VSMOV) sang đường của NguonC, và payload của NguonC sang shape
 * mà UI đang dùng.
 *
 * Vì sao tách khỏi `nguonc.ts`: file này **không import gì chạy được** (chỉ import
 * type, bị xoá khi biên dịch) nên test dịch được một file duy nhất — cùng lý do
 * với `catalogFallback.ts`. Cũng chính vì thế mà nó đáng được test: lệch một chữ
 * trong bảng dịch là im lặng, không có lỗi nào hiện ra ở đâu cả.
 */
import type { Episode, Movie, MovieList, TaxonomyItem, TaxonomyList } from './types';

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

/** Bỏ dấu để so nhãn nhóm với chuỗi tiếng Việt trong payload. */
const fold = (value: unknown): string =>
  String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

/** "A, B, C" → ['A','B','C'] — NguonC để diễn viên/đạo diễn chung một chuỗi. */
const splitList = (value: unknown): string[] =>
  (str(value) ?? '').split(',').map((part) => part.trim()).filter(Boolean);

/**
 * Thể loại của NguonC, chép từ menu phim.nguonc.com (2026-09). Nguồn không có
 * endpoint liệt kê nên đây là bản duy nhất, và cũng là thứ để menu của web có
 * những thể loại VSMOV không có (Tâm Lý, Tình Cảm, Miền Tây...).
 */
export const NGUONC_GENRES: TaxonomyItem[] = [
  ['hanh-dong', 'Hành Động'], ['tinh-cam', 'Tình Cảm'], ['chinh-kich', 'Chính Kịch'],
  ['tam-ly', 'Tâm Lý'], ['kinh-di', 'Kinh Dị'], ['bi-an', 'Bí Ẩn'],
  ['hinh-su', 'Hình Sự'], ['gay-can', 'Gây Cấn'], ['phieu-luu', 'Phiêu Lưu'],
  ['co-trang', 'Cổ Trang'], ['lich-su', 'Lịch Sử'], ['chien-tranh', 'Chiến Tranh'],
  ['khoa-hoc-vien-tuong', 'Khoa Học Viễn Tưởng'], ['gia-tuong', 'Giả Tưởng'], ['phim-hai', 'Hài'],
  ['hoat-hinh', 'Hoạt Hình'], ['gia-dinh', 'Gia Đình'], ['phim-nhac', 'Nhạc'],
  ['tai-lieu', 'Tài Liệu'], ['lang-man', 'Lãng Mạn'], ['mien-tay', 'Miền Tây'],
  ['phim-18', 'Phim 18+']
].map(([slug, name]) => ({ id: slug, name, slug, thumbUrl: null }));

/** Danh mục của thanh menu: NguonC chỉ có thể loại, quốc gia/năm do VSMOV lo. */
export function nguoncTaxonomy(path: string): TaxonomyList | null {
  if (path.replace(/\/+$/, '') !== '/the-loai') return null;
  return { items: NGUONC_GENRES, source: 'nguonc' };
}

/**
 * URL kiểu VSMOV (thứ `catalogTarget()` trả về) → đường của NguonC.
 * Không dịch được (danh mục NguonC không có) thì trả `null` để chỗ gọi rơi tiếp.
 */
export function nguoncPath(url: string): string | null {
  const cut = url.indexOf('?');
  const path = (cut === -1 ? url : url.slice(0, cut)).replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  const query = cut === -1 ? '' : url.slice(cut);
  // `/danh-sach/phim-moi-cap-nhat` của VSMOV là endpoint riêng bên NguonC, không
  // nằm trong nhóm `/films/danh-sach/:slug` (đường đó trả 404).
  if (path === '/danh-sach/phim-moi-cap-nhat') return `/films/phim-moi-cap-nhat${query}`;
  const groups: [string, string][] = [
    ['/danh-sach/', '/films/danh-sach/'],
    ['/the-loai/', '/films/the-loai/'],
    ['/quoc-gia/', '/films/quoc-gia/'],
    ['/nam/', '/films/nam-phat-hanh/']
  ];
  for (const [from, to] of groups) if (path.startsWith(from)) return `${to}${path.slice(from.length)}${query}`;
  if (path === '/tim-kiem') return `/films/search${query}`;
  return null;
}

/** Đường chi tiết: VSMOV `/phim/:slug` → NguonC `/film/:slug`. */
export const nguoncDetailPath = (slug: string) => `/film/${encodeURIComponent(slug)}`;

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

/** Thẻ phim từ payload NguonC; `id: 0` vì id thật chỉ có trong kho của API. */
export function movieFromNguonc(item: any): Movie | null {
  const slug = str(item?.slug);
  const name = str(item?.name) ?? str(item?.original_name) ?? slug;
  if (!slug || !name) return null;
  return {
    id: 0,
    provider: 'nguonc',
    providerId: item?.id == null ? null : String(item.id),
    slug, name,
    originName: str(item?.original_name),
    description: str(item?.description),
    type: typeOf(item),
    status: statusOf(item),
    // Bản detail thiếu `year` — năm thật nằm trong nhóm "Năm" của `category`.
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

/** Payload danh sách → `MovieList`; `paginate` là snake_case của nguồn. */
export function listFromNguonc(payload: unknown, limit: number): MovieList {
  const data: any = (payload as any)?.data ?? payload ?? {};
  const items = (Array.isArray(data.items) ? data.items : [])
    .map(movieFromNguonc)
    .filter((movie: Movie | null): movie is Movie => movie !== null);
  const p = data.paginate ?? {};
  const perPage = Math.max(1, Math.trunc(Number(p.items_per_page) || limit));
  const totalItems = Math.max(0, Math.trunc(Number(p.total_items)) || items.length);
  const totalPages = Math.max(1, Math.trunc(Number(p.total_page) || Math.ceil(totalItems / perPage) || 1));
  const currentPage = Math.min(totalPages, Math.max(1, Math.trunc(Number(p.current_page) || 1)));
  return { items, pagination: { totalItems, totalPages, currentPage, totalItemsPerPage: perPage }, source: 'nguonc' };
}

/** Nhóm tập theo shape `IngestPayload` của API (`server_name` + `server_data`). */
export interface NguoncEpisodes {
  server_name: string;
  server_data: { name: string; filename: string | null; link_embed: string; link_m3u8: string | null }[];
}

/** `movie.episodes[].items[]` → nhóm tập; NguonC chỉ có `embed`, không có m3u8. */
export function episodesFromPayload(payload: unknown, slug: string): { movie: Movie; episodes: NguoncEpisodes[] } | null {
  const data: any = (payload as any)?.data ?? payload ?? {};
  const raw = data.movie ?? (payload as any)?.movie;
  const movie = raw && movieFromNguonc(raw);
  if (!movie) return null;
  if (!movie.slug) movie.slug = slug;
  const groups: any[] = Array.isArray(raw.episodes) ? raw.episodes : [];
  const episodes: NguoncEpisodes[] = groups
    .map((group) => ({
      server_name: str(group?.server_name) ?? 'Mặc định',
      server_data: (Array.isArray(group?.items) ? group.items : [])
        .map((entry: any) => ({
          name: str(entry?.name) ?? str(entry?.slug) ?? 'Full',
          filename: null,
          link_embed: str(entry?.embed) ?? '',
          // NguonC phát qua embed — không tập nào có m3u8.
          link_m3u8: null
        }))
        .filter((entry: { link_embed: string }) => entry.link_embed)
    }))
    .filter((group: NguoncEpisodes) => group.server_data.length);
  return { movie, episodes };
}

/**
 * Nhóm tập của NguonC (chưa có id trong kho) → `Episode[]` với id âm — đủ để bấm
 * xem, và không đụng id thật khi ingest xong.
 */
export function episodesFromNguonc(groups: NguoncEpisodes[]): Episode[] {
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