/**
 * Thư viện của thiết bị: phim đã lưu và tiến trình xem.
 *
 * Vì sao không chỉ dựa vào API: API là một chặng nữa có thể chết (service bị xoá,
 * hết credit — chuyện đã xảy ra), còn đây là dữ liệu *của người xem*, không phải
 * catalog. Mất API thì trang chủ vẫn dựng được nhờ đường dự phòng của nguồn,
 * nhưng thư viện trắng trơn là mất hẳn tính năng. Nên bản ghi nằm ở thiết bị
 * trước, còn API (khi sống) là bản đồng bộ thêm.
 *
 * Vì sao tiến trình ghi cho **mọi** tập, kể cả tập id âm: tập đến thẳng từ nguồn
 * (id âm) không gửi được lên API, nhưng máy này vẫn phải nhớ đã xem tới đâu —
 * nếu không, phim xem qua đường dự phòng sẽ không bao giờ hiện trong "Xem tiếp".
 *
 * File không import gì chạy được (chỉ import type, bị xoá khi biên dịch) nên test
 * dịch được một file duy nhất, như `filters.ts` và `catalogFallback.ts`.
 */
import type { Movie } from './types';
import type { MoviePreview } from './preview';

export const LIBRARY_STORAGE_KEY = 'cinema-library-v1';
export const FAVORITE_LIMIT = 500;
export const PROGRESS_LIMIT = 400;
/** Trần của dải "Xem tiếp"/"Đã xem" — khớp với LIMIT của API. */
export const CONTINUE_LIMIT = 12;

/** Một phim đã lưu, kèm mốc thời gian để sắp xếp. */
export interface SavedEntry { movie: MoviePreview; savedAt: number }

/** Tiến trình của một tập trên máy này. */
export interface ProgressEntry {
  movie: MoviePreview;
  episodeId: number;
  episodeName: string;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export interface LibraryState {
  favorites: Record<string, SavedEntry>;
  progress: Record<string, ProgressEntry>;
}

/** Một dòng của API (`GET /continue-watching`) — tên field đúng như JSON trả về. */
export interface RemoteProgress {
  episode_id: number;
  position_seconds?: number | null;
  duration_seconds?: number | null;
  completed?: boolean;
  updated_at?: string | null;
  slug: string;
  name?: string | null;
  thumbUrl?: string | null;
  episodeName?: string | null;
}

/** Một dòng của "Xem tiếp"/"Đã xem": mỗi **phim** một dòng, tập mới nhất được giữ. */
export interface ContinueItem {
  slug: string;
  name: string;
  thumbUrl: string | null;
  episodeId: number;
  episodeName: string;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
  /** Bản mô tả đầy đủ khi có (bản ghi của máy) — dùng làm `state` khi mở lại. */
  movie: MoviePreview | null;
}

export const emptyLibrary = (): LibraryState => ({ favorites: {}, progress: {} });
export const progressKey = (slug: string, episodeId: number) => `${slug}|${episodeId}`;

const timestamp = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const number = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Đọc JSON đã lưu; thiếu/hỏng thì coi như thư viện trống chứ không ném lỗi. */
export function parseLibrary(raw: string | null): LibraryState {
  if (!raw) return emptyLibrary();
  try {
    const parsed = JSON.parse(raw) as Partial<LibraryState>;
    const favorites: Record<string, SavedEntry> = {};
    const progress: Record<string, ProgressEntry> = {};
    for (const [slug, entry] of Object.entries(parsed?.favorites ?? {})) {
      if (!entry?.movie?.slug) continue;
      favorites[slug] = { movie: entry.movie, savedAt: timestamp(entry.savedAt) };
    }
    for (const [key, entry] of Object.entries(parsed?.progress ?? {})) {
      if (!entry?.movie?.slug) continue;
      const episodeId = number(entry.episodeId);
      if (!Number.isFinite(Number(entry.episodeId))) continue;
      progress[key] = {
        movie: entry.movie,
        episodeId,
        episodeName: String(entry.episodeName ?? ''),
        position: number(entry.position),
        duration: number(entry.duration),
        completed: Boolean(entry.completed),
        updatedAt: timestamp(entry.updatedAt)
      };
    }
    return { favorites, progress };
  } catch {
    return emptyLibrary();
  }
}

export const serializeLibrary = (state: LibraryState) => JSON.stringify(state);

/** Hai loại bản ghi của thư viện, chỉ cần đúng một mốc thời gian để so tuổi. */
type DatedRecord = { savedAt?: number; updatedAt?: number };
/** Bỏ bản ghi cũ nhất khi vượt trần — thư viện là bản lưu của máy, không phình mãi. */
function trim<T extends Record<string, DatedRecord>>(
  records: T, limit: number, at: (entry: DatedRecord) => number
): T {
  const keys = Object.keys(records);
  if (keys.length <= limit) return records;
  const keep = keys.sort((a, b) => at(records[b]) - at(records[a])).slice(0, limit);
  return Object.fromEntries(keep.map((key) => [key, records[key]])) as T;
}

export function addFavorite(state: LibraryState, movie: MoviePreview, now = Date.now()): LibraryState {
  const favorites = { ...state.favorites, [movie.slug]: { movie, savedAt: now } };
  return { ...state, favorites: trim(favorites, FAVORITE_LIMIT, (entry) => entry.savedAt ?? 0) };
}

export function dropFavorite(state: LibraryState, slug: string): LibraryState {
  if (!state.favorites[slug]) return state;
  const favorites = { ...state.favorites };
  delete favorites[slug];
  return { ...state, favorites };
}

export function addProgress(state: LibraryState, entry: ProgressEntry): LibraryState {
  const key = progressKey(entry.movie.slug, entry.episodeId);
  const progress = { ...state.progress, [key]: entry };
  return { ...state, progress: trim(progress, PROGRESS_LIMIT, (item) => item.updatedAt ?? 0) };
}

/**
 * Phim đã lưu: bản của API đứng trước (dữ liệu kho luôn mới hơn bản chụp trên
 * máy), rồi bù những phim máy có mà kho không có. Gộp theo slug nên phim vừa
 * lưu ở máy vừa có trong kho chỉ hiện một lần.
 */
export function mergeFavorites(remote: Movie[] | undefined, local: SavedEntry[] | undefined): Movie[] {
  const seen = new Set<string>();
  const movies: Movie[] = [];
  for (const movie of remote ?? []) {
    if (!movie?.slug || seen.has(movie.slug)) continue;
    seen.add(movie.slug);
    movies.push(movie);
  }
  for (const entry of local ?? []) {
    const movie = entry?.movie;
    if (!movie?.slug || seen.has(movie.slug)) continue;
    seen.add(movie.slug);
    movies.push(movie);
  }
  return movies;
}

/**
 * Gộp tiến trình của API với tiến trình trên máy thành **một dòng cho mỗi phim**.
 *
 * `watch_progress` có khoá theo *tập*, nên một series 10 tập nằm 10 dòng; gộp lại
 * lấy tập mới nhất rồi mới tách "đang xem dở" và "đã xem".
 */
export function continueItems(
  remote: RemoteProgress[] | undefined,
  local: ProgressEntry[] | undefined
): { watching: ContinueItem[]; watched: ContinueItem[] } {
  const latest = new Map<string, ContinueItem>();
  const put = (item: ContinueItem) => {
    const current = latest.get(item.slug);
    if (!current || item.updatedAt > current.updatedAt) latest.set(item.slug, item);
  };

  for (const row of remote ?? []) {
    if (!row?.slug || !Number.isFinite(Number(row.episode_id))) continue;
    put({
      slug: row.slug,
      name: String(row.name ?? row.slug),
      thumbUrl: row.thumbUrl ?? null,
      episodeId: Number(row.episode_id),
      episodeName: String(row.episodeName ?? ''),
      position: number(row.position_seconds),
      duration: number(row.duration_seconds),
      completed: false,
      updatedAt: timestamp(row.updated_at),
      movie: null
    });
  }

  for (const entry of local ?? []) {
    const movie = entry?.movie;
    if (!movie?.slug || !Number.isFinite(entry.episodeId)) continue;
    put({
      slug: movie.slug,
      name: movie.name,
      thumbUrl: movie.thumbUrl ?? movie.posterUrl ?? null,
      episodeId: entry.episodeId,
      episodeName: entry.episodeName,
      position: entry.position,
      duration: entry.duration,
      completed: entry.completed,
      updatedAt: entry.updatedAt,
      movie
    });
  }

  const all = [...latest.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    watching: all.filter((item) => !item.completed).slice(0, CONTINUE_LIMIT),
    watched: all.filter((item) => item.completed).slice(0, CONTINUE_LIMIT)
  };
}

/** "Tập 3" cho tên tập dạng số; nguồn đã ghi rõ "Full"/"Tập 3" thì giữ nguyên. */
export function episodeLabel(name: string): string {
  const text = String(name ?? '').trim();
  if (!text) return '';
  return /^(tập|tap|full|hoàn tất|hoan tat)\b/i.test(text) ? text : `Tập ${text}`;
}

/** Phần trăm đã xem, 0 khi chưa biết thời lượng (embed không báo về được). */
export function progressPercent(item: Pick<ContinueItem, 'position' | 'duration'>): number {
  if (!item.duration || item.duration <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((item.position / item.duration) * 100)));
}
