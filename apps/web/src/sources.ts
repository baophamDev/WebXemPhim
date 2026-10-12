/**
 * Sổ nguồn phim gọi thẳng từ trình duyệt, và cách thử lần lượt.
 *
 * Sau khi bỏ backend (Railway hết hạn), đây là nơi duy nhất biết có những nguồn
 * nào và thứ tự ưu tiên. Ba nguồn:
 * - **KKPhim** (phimapi.com): có `link_m3u8` thật → phát thẳng, ưu tiên khi xem.
 * - **NguonC** (phim.nguonc.com): chỉ embed (`*.streamc.xyz`), nhưng catalog +
 *   thể loại phong phú → ưu tiên khi dựng danh sách/menu.
 * - **VSMOV**: m3u8 rỗng, chỉ còn phần chữ → chặng cuối.
 *
 * `catalogTarget()` (catalogFallback.ts) dịch route `/catalog/*` thành `CatalogTarget`;
 * mỗi nguồn có `target()` trả **đúng shape API**. `resolveCatalog` thử theo
 * `CATALOG_ORDER`, `resolveMovie` theo `PLAYBACK_ORDER` (ưu tiên nguồn có m3u8).
 */
import type { CatalogTarget } from './catalogFallback';
import type { Episode, Movie, MovieList } from './types';
import type { IngestPayload } from './vsmov';
import { sameTitle, searchKeywords, type TitleHint } from './match';
import { episodesFromVsmov, vsmovDetail, vsmovSearch, vsmovTarget } from './vsmov';
import { nguoncDetail, nguoncSearch, nguoncTarget } from './nguonc';
import { episodesFromNguonc } from './nguoncMap';
import { episodesFromKkphim, kkphimDetail, kkphimSearch, kkphimTarget } from './kkphim';

export type SourceId = 'kkphim' | 'nguonc' | 'vsmov';

type Groups = IngestPayload['episodes'];
interface SourceDef {
  id: SourceId;
  label: string;
  target: (target: CatalogTarget) => Promise<unknown>;
  detail: (slug: string) => Promise<IngestPayload>;
  search: (keyword: string, page?: number, limit?: number) => Promise<MovieList>;
  toEpisodes: (groups: Groups) => Episode[];
}

export const SOURCES: Record<SourceId, SourceDef> = {
  kkphim: { id: 'kkphim', label: 'KKPhim', target: kkphimTarget, detail: kkphimDetail, search: kkphimSearch, toEpisodes: episodesFromKkphim },
  nguonc: { id: 'nguonc', label: 'NguonC', target: nguoncTarget, detail: nguoncDetail, search: nguoncSearch, toEpisodes: episodesFromNguonc as (g: Groups) => Episode[] },
  vsmov: { id: 'vsmov', label: 'VSMOV', target: vsmovTarget, detail: vsmovDetail, search: vsmovSearch, toEpisodes: episodesFromVsmov }
};

/** Thứ tự hiện trên nút chọn nguồn (người xem ép tay được cả ba). */
export const SOURCE_IDS: SourceId[] = ['kkphim', 'nguonc', 'vsmov'];
/** Dựng danh sách/menu: NguonC giàu catalog + có thể loại nên đứng đầu. */
export const CATALOG_ORDER: SourceId[] = ['nguonc', 'kkphim', 'vsmov'];
/**
 * Tự chọn nguồn phát: KKPhim (m3u8 thật) rồi NguonC (embed). **Không** gồm VSMOV:
 * `vsmov.com/api/phim/:slug` không trả CORS nên trình duyệt không đọc được chi tiết,
 * mà VSMOV cũng không có m3u8 — để trong vòng auto chỉ tổ gọi hụt mỗi lần. Vẫn giữ
 * nút VSMOV ở `SOURCE_IDS` để người xem ép tay (sẽ báo không phát được nếu bị chặn).
 */
export const PLAYBACK_ORDER: SourceId[] = ['kkphim', 'nguonc'];

export interface ResolvedDetail { movie: Movie; episodes: Episode[]; sourceId: SourceId }

const hasM3u8 = (episodes: Episode[]) => episodes.some((episode) => episode.m3u8Url);

/**
 * Lấy chi tiết một phim từ **một** nguồn. Thử thẳng slug (nếu slug thuộc hệ nguồn
 * đó), không có thì tìm theo tên/năm rồi mới lấy chi tiết. `null` nghĩa là nguồn
 * này không có phim này (chỗ gọi thử nguồn khác).
 */
async function detailFrom(id: SourceId, hint: TitleHint): Promise<ResolvedDetail | null> {
  const source = SOURCES[id];
  let payload: IngestPayload | null = null;
  if (hint.slug) {
    payload = await source.detail(hint.slug).catch(() => null);
  }
  if (!payload) {
    for (const keyword of searchKeywords(hint)) {
      const found = await source.search(keyword, 1, 10).catch(() => null);
      const match = found?.items.find((item) => sameTitle(item.name, item.originName, hint, item.year));
      if (match?.slug) {
        payload = await source.detail(match.slug).catch(() => null);
        if (payload) break;
      }
    }
  }
  if (!payload) return null;
  const episodes = source.toEpisodes(payload.episodes);
  if (!episodes.length) return null;
  return { movie: { ...payload.movie, id: 0, episodes } as Movie, episodes, sourceId: id };
}

/**
 * Chỉ có slug mà chưa có tên (mở thẳng link): hỏi một nguồn bất kỳ để lấy tên/năm,
 * nhờ đó khi dò nguồn khác (slug khác hệ) còn so khớp theo tên được.
 */
async function ensureName(hint: TitleHint): Promise<TitleHint> {
  if (hint.name || !hint.slug) return hint;
  for (const id of CATALOG_ORDER) {
    const payload = await SOURCES[id].detail(hint.slug).catch(() => null);
    if (payload) return { name: payload.movie.name, originName: payload.movie.originName, year: payload.movie.year, slug: hint.slug };
  }
  return hint;
}

/** Lấy chi tiết từ đúng một nguồn người xem chọn (nút đổi nguồn). */
export async function fetchFromSource(id: SourceId, hint: TitleHint): Promise<ResolvedDetail | null> {
  return detailFrom(id, await ensureName(hint));
}

/**
 * Tự chọn nguồn tốt nhất để phát: đi theo `order`, **thắng ngay** nguồn đầu có
 * m3u8 thật; không nguồn nào có m3u8 thì trả nguồn đầu còn tập (embed) làm dự phòng.
 */
export async function resolveMovie(hint: TitleHint, order: SourceId[] = PLAYBACK_ORDER): Promise<ResolvedDetail | null> {
  const full = await ensureName(hint);
  let fallback: ResolvedDetail | null = null;
  for (const id of order) {
    const result = await detailFrom(id, full).catch(() => null);
    if (!result) continue;
    if (hasM3u8(result.episodes)) return result;
    fallback ??= result;
  }
  return fallback;
}

const usable = (target: CatalogTarget, value: any): boolean => {
  if (!value) return false;
  if (target.kind === 'navigation') return Array.isArray(value.genres) && value.genres.length > 0;
  if (target.kind === 'taxonomy') return Array.isArray(value.items) && value.items.length > 0;
  if (target.kind === 'detail') return Boolean(value.movie);
  return Array.isArray(value.items) && value.items.length > 0;
};

/**
 * Chạy một `CatalogTarget` qua các nguồn (thay cho API). Danh sách/menu thử theo
 * `CATALOG_ORDER`, nguồn đầu dùng được thì thắng; chi tiết đi qua `resolveMovie`
 * để ưu tiên nguồn phát được. Danh sách/menu rỗng thì trả rỗng (trang hiện "không
 * có") thay vì ném — chỉ chi tiết mới ném khi không nguồn nào có.
 */
export async function resolveCatalog(target: CatalogTarget): Promise<unknown> {
  if (target.kind === 'detail') {
    const resolved = await resolveMovie({ name: '', slug: target.slug }, PLAYBACK_ORDER);
    if (resolved) return { movie: resolved.movie };
    throw new Error(`Không nguồn nào có phim "${target.slug}"`);
  }
  let lastError: unknown = null;
  for (const id of CATALOG_ORDER) {
    try {
      const value = await SOURCES[id].target(target);
      if (usable(target, value)) return value;
    } catch (error) { lastError = error; }
  }
  if (target.kind === 'list') return { items: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1, totalItemsPerPage: target.limit }, source: 'none' };
  if (target.kind === 'taxonomy') return { items: [], source: 'none' };
  if (target.kind === 'navigation') return { genres: [], countries: [], years: [] };
  throw lastError instanceof Error ? lastError : new Error('Không nguồn nào trả dữ liệu');
}

