/**
 * Kiểu dữ liệu catalog — nguồn duy nhất là VSMOV.
 *
 * Mọi hàm trong `vsmov.ts` trả shape đã chuẩn hoá (`ListPage`/`Taxonomy`/
 * `SourceDetail`) chứ không phải payload thô của nguồn.
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

/** Chi tiết một phim kèm danh sách tập phát được từ VSMOV. */
export interface VsmovDetail extends SourceDetail {
  /** Nguồn đã trả lời — luôn là `vsmov`, giữ để client hiển thị. */
  source: string;
}
