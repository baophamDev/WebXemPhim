/**
 * Chuẩn hoá và kiểm tra dữ liệu **ở biên** giữa nguồn ngoài và API.
 *
 * Trước đây payload của nguồn đi thẳng vào `any` rồi chảy tới DB. Nguồn đổi tên
 * một field là web hiện phim trắng, không có chỗ nào báo lỗi. Giờ mỗi nguồn phải
 * đi qua đây: thiếu field bắt buộc thì ném ngay tại nguồn đó, và resolver còn
 * nguồn khác để rơi xuống.
 *
 * Nguyên tắc: chuẩn hoá phải **rộng khi đọc, chặt khi trả**. Đọc thì nhận cả
 * snake_case của nguồn lẫn camelCase; trả thì luôn đúng `MovieSummary`.
 */
import { z } from 'zod';
import { fold } from '../text.js';
import type { EpisodeGroup, ListPage, MovieSummary, Pagination, SourceDetail, Taxonomy } from './types.js';

/** Chuỗi rỗng/khoảng trắng coi như không có, để nguồn khác bồi vào được. */
export const str = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
};

/** Nhận `['A','B']` hoặc `[{name:'A'}]` — hai kiểu các nguồn hay dùng lẫn nhau. */
export const names = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item : str((item as { name?: unknown })?.name)))
        .filter((name): name is string => Boolean(name))
    : [];

/** URL ảnh phải là http(s) tuyệt đối; `data:`/đường dẫn tương đối bỏ đi. */
export const imageUrl = (value: unknown): string | null => {
  const raw = str(value);
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
};

const movieSummarySchema = z.object({
  provider: z.string().min(1),
  providerId: z.string().nullable(),
  slug: z.string().min(1).max(160).regex(/^[a-zA-Z0-9._-]+$/, 'slug chứa ký tự không dùng được trong URL'),
  name: z.string().min(1),
  originName: z.string().nullable(),
  description: z.string().nullable(),
  type: z.string().min(1),
  status: z.string().nullable(),
  year: z.number().int().nullable(),
  duration: z.string().nullable(),
  quality: z.string().nullable(),
  language: z.string().nullable(),
  posterUrl: z.string().nullable(),
  thumbUrl: z.string().nullable(),
  trailerUrl: z.string().nullable(),
  rating: z.number().nullable(),
  viewCount: z.number(),
  tmdbId: z.string().nullable(),
  imdbId: z.string().nullable(),
  genres: z.array(z.string()),
  countries: z.array(z.string()),
  actors: z.array(z.string()),
  directors: z.array(z.string())
});

const paginationSchema = z.object({
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
  currentPage: z.number().int().positive(),
  totalItemsPerPage: z.number().int().positive()
});

export const listPageSchema = z.object({ items: z.array(movieSummarySchema), pagination: paginationSchema });
export const taxonomySchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string().min(1), slug: z.string().min(1), thumbUrl: z.string().nullable() }))
});
export const sourceDetailSchema = z.object({
  movie: movieSummarySchema,
  episodes: z.array(z.object({
    server_name: z.string().min(1),
    server_data: z.array(z.object({
      name: z.string().min(1),
      filename: z.string().nullable().optional(),
      link_embed: z.string().min(1),
      link_m3u8: z.string().nullable().optional()
    }))
  }))
});

/**
 * Giá trị mặc định cho mọi field, để adapter chỉ cần ghi những gì nguồn có.
 * Không dùng `undefined` ở đâu cả: `null` phân biệt được "nguồn không có" với
 * "chưa hỏi", và bồi metadata dựa vào chính điều đó.
 */
export function emptyMovie(provider: string, slug: string, name: string): MovieSummary {
  return {
    provider, providerId: null, slug, name, originName: null, description: null, type: 'single',
    status: null, year: null, duration: null, quality: null, language: null, posterUrl: null,
    thumbUrl: null, trailerUrl: null, rating: null, viewCount: 0, tmdbId: null, imdbId: null,
    genres: [], countries: [], actors: [], directors: []
  };
}

export function makePagination(input: {
  totalItems?: unknown; totalPages?: unknown; currentPage?: unknown; limit?: unknown; itemCount: number;
}): Pagination {
  const limit = Math.max(1, Math.trunc(Number(input.limit) || 24));
  // `Math.trunc` luôn trả về number (NaN nếu nguồn gửi rác), nên `|| itemCount`
  // là nhánh dự phòng duy nhất cần có — `?? 0` trước đây không bao giờ chạy tới.
  const totalItems = Math.max(0, Math.trunc(Number(input.totalItems)) || input.itemCount);
  const totalPages = Math.max(1, Math.trunc(Number(input.totalPages) || Math.ceil(totalItems / limit) || 1));
  const currentPage = Math.min(totalPages, Math.max(1, Math.trunc(Number(input.currentPage) || 1)));
  return { totalItems, totalPages, currentPage, totalItemsPerPage: limit };
}

/** Ném `ZodError` kèm tên nguồn nếu adapter trả sai shape. */
export function checkList(source: string, value: unknown): ListPage {
  return withSource(source, () => listPageSchema.parse(value));
}
export function checkTaxonomy(source: string, value: unknown): Taxonomy {
  return withSource(source, () => taxonomySchema.parse(value));
}
export function checkDetail(source: string, value: unknown): SourceDetail {
  return withSource(source, () => sourceDetailSchema.parse(value) as SourceDetail);
}

function withSource<T>(source: string, run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      throw new Error(`Nguồn ${source} trả dữ liệu sai shape tại "${first?.path.join('.') || '(gốc)'}": ${first?.message}`);
    }
    throw error;
  }
}

/**
 * Điểm khớp giữa hai phim ở hai nguồn khác nhau, dùng khi một nguồn không có
 * slug mà nguồn kia có. 1 là chắc chắn, dưới `MATCH_THRESHOLD` thì coi như không
 * tìm thấy — thà thiếu metadata còn hơn gán poster của phim khác.
 */
export const MATCH_THRESHOLD = 0.72;

export function matchScore(
  a: { name?: string | null; originName?: string | null; year?: number | null },
  b: { name?: string | null; originName?: string | null; year?: number | null }
): number {
  const left = [fold(a.name), fold(a.originName)].filter(Boolean);
  const right = [fold(b.name), fold(b.originName)].filter(Boolean);
  if (!left.length || !right.length) return 0;
  let best = 0;
  for (const x of left) for (const y of right) best = Math.max(best, similarity(x, y));
  if (a.year && b.year) {
    // Lệch 1 năm là chuyện thường (ngày phát hành theo quốc gia); lệch hơn thì trừ nặng.
    const gap = Math.abs(a.year - b.year);
    if (gap === 0) best += 0.08;
    else if (gap > 1) best -= 0.3;
  }
  return Math.max(0, Math.min(1, best));
}

/** Dice coefficient trên bigram: rẻ, không phụ thuộc thứ tự từ, đủ cho tên phim. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const count = bigrams.get(gram) ?? 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      hits++;
    }
  }
  return (2 * hits) / (a.length - 1 + b.length - 1);
}

/** Field nào của nguồn metadata được phép bồi vào chỗ trống của nguồn phát. */
const FILLABLE = [
  'originName', 'description', 'posterUrl', 'thumbUrl', 'trailerUrl', 'rating',
  'year', 'duration', 'language', 'tmdbId', 'imdbId'
] as const;

/**
 * Bồi metadata: chỉ ghi vào field đang `null`/rỗng của `base`, không bao giờ
 * ghi đè. Nguồn phát là nguồn sự thật về phim nó phát (tên, tập, chất lượng);
 * nguồn metadata chỉ lấp lỗ.
 */
export function enrich(base: MovieSummary, extra: Partial<MovieSummary>): MovieSummary {
  const merged = { ...base } as MovieSummary & Record<string, unknown>;
  for (const key of FILLABLE) {
    if (merged[key] == null && extra[key] != null) merged[key as string] = extra[key];
  }
  for (const key of ['genres', 'countries', 'actors', 'directors'] as const) {
    if (!merged[key].length && extra[key]?.length) merged[key] = [...extra[key]];
  }
  return merged;
}

export function episodeCount(groups: EpisodeGroup[]): number {
  return groups.reduce((total, group) => total + group.server_data.length, 0);
}
