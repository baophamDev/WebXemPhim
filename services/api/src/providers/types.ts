/**
 * Hợp đồng giữa API và các nguồn catalog.
 *
 * Ba thay đổi so với bản một-nguồn trước đây:
 *
 * 1. **Method là optional.** Không nguồn nào cũng có đủ 14 khả năng — TMDB không
 *    có "code phim", nguồn phát thì không có ảnh diễn viên chuẩn. Resolver bỏ qua
 *    nguồn thiếu method thay vì để nó ném lỗi ở runtime.
 * 2. **`kind` phân biệt nguồn phát được và nguồn chỉ có metadata.** Chỉ nguồn
 *    `playable` mới trả về được `episodes` để phát; nguồn `metadata` dùng để bồi
 *    thêm poster/rating/cast vào field còn trống.
 * 3. **Mọi method trả shape đã chuẩn hoá** (`ListPage`, `Taxonomy`,
 *    `SourceDetail`) chứ không phải payload thô của nguồn. Trước đây `detail()`
 *    trả thẳng JSON của vsmov nên tên field của vsmov rò rỉ vào tận `db.ts`;
 *    thêm nguồn thứ hai là phải bắt nguồn mới giả dạng vsmov.
 */

export interface CatalogFilters {
  page?: number;
  limit?: number;
  year?: string;
  country?: string;
  category?: string;
  type?: string;
  status?: string;
}

/** `playable` phát được phim; `metadata` chỉ mô tả phim. */
export type SourceKind = 'playable' | 'metadata';

export type Capability =
  | 'latest' | 'home' | 'list' | 'search' | 'genres' | 'byGenre' | 'countries'
  | 'byCountry' | 'years' | 'byYear' | 'actors' | 'codes' | 'byCode' | 'detail';

export interface Pagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  totalItemsPerPage: number;
}

/**
 * Một phim ở dạng đã chuẩn hoá. Tên field khớp với thứ `db.upsertMovie()` đọc
 * được, nên resolver ghi thẳng vào DB mà không cần lớp map thứ hai.
 */
export interface MovieSummary {
  provider: string;
  providerId: string | null;
  slug: string;
  name: string;
  originName: string | null;
  description: string | null;
  type: string;
  status: string | null;
  year: number | null;
  duration: string | null;
  quality: string | null;
  language: string | null;
  posterUrl: string | null;
  thumbUrl: string | null;
  trailerUrl: string | null;
  rating: number | null;
  viewCount: number;
  tmdbId: string | null;
  imdbId: string | null;
  genres: string[];
  countries: string[];
  actors: string[];
  directors: string[];
}

export interface ListPage {
  items: MovieSummary[];
  pagination: Pagination;
}

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  thumbUrl: string | null;
}

export interface Taxonomy {
  items: TaxonomyItem[];
}

/**
 * Giữ nguyên tên field snake_case của nhóm tập: `db.upsertEpisodes()` đã đọc
 * shape này, và nó là quy ước chung của các API catalog phim nên nguồn mới cắm
 * vào không phải học thêm gì.
 */
export interface EpisodeEntry {
  name: string;
  filename?: string | null;
  link_embed: string;
  link_m3u8?: string | null;
}

export interface EpisodeGroup {
  server_name: string;
  server_data: EpisodeEntry[];
}

export interface SourceDetail {
  movie: MovieSummary;
  episodes: EpisodeGroup[];
}

/**
 * Một nguồn catalog. Chỉ `name` và `kind` là bắt buộc; phần còn lại tuỳ nguồn
 * làm được đến đâu, resolver tự dò bằng `typeof source[capability] === 'function'`.
 */
export interface CatalogSource {
  readonly name: string;
  readonly kind: SourceKind;
  latest?(page: number, limit?: number): Promise<ListPage>;
  home?(filters?: CatalogFilters): Promise<ListPage>;
  list?(slug: string, filters?: CatalogFilters): Promise<ListPage>;
  search?(keyword: string, filters?: CatalogFilters): Promise<ListPage>;
  genres?(): Promise<Taxonomy>;
  byGenre?(slug: string, filters?: CatalogFilters): Promise<ListPage>;
  countries?(): Promise<Taxonomy>;
  byCountry?(slug: string, filters?: CatalogFilters): Promise<ListPage>;
  years?(): Promise<Taxonomy>;
  byYear?(year: string, filters?: CatalogFilters): Promise<ListPage>;
  actors?(): Promise<Taxonomy>;
  codes?(): Promise<Taxonomy>;
  byCode?(code: string, filters?: CatalogFilters): Promise<ListPage>;
  detail?(slug: string): Promise<SourceDetail>;
}

/** Trạng thái một nguồn, phục vụ `GET /api/providers`. */
export interface SourceHealth {
  name: string;
  kind: SourceKind;
  capabilities: Capability[];
  healthy: boolean;
  failures: number;
  /** Thời điểm circuit đóng lại (ISO) — null nghĩa là đang mở cho request. */
  openUntil: string | null;
  lastError: string | null;
  lastSuccessAt: string | null;
}
