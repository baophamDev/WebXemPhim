/**
 * Resolver: một mặt tiền duy nhất cho nhiều nguồn catalog.
 *
 * Bản trước chọn **một** nguồn bằng `CATALOG_PROVIDER` rồi gọi thẳng. Nguồn đó
 * chết là toàn bộ trang danh sách, tìm kiếm và chi tiết phim chết theo — chỉ menu
 * điều hướng còn sống vì nó có đường lùi về DB. Resolver ở đây làm ba việc:
 *
 * 1. **Fallback theo thứ tự ưu tiên.** Duyệt các nguồn đã bật, bỏ qua nguồn không
 *    có khả năng đang cần, trả về kết quả đầu tiên hợp lệ. Tất cả đổ thì mới ném,
 *    kèm lý do của từng nguồn để đọc log là biết chuyện gì.
 * 2. **Circuit breaker.** Nguồn lỗi liên tiếp thì tạm ngừng gọi trong một khoảng
 *    tăng dần. Không có nó, mỗi request lại phải chờ hết timeout của nguồn chết
 *    trước khi thử nguồn sau — người dùng thấy trang treo 20 giây rồi mới có nội
 *    dung, tệ hơn là không có nguồn thứ hai.
 * 3. **Khớp slug chéo nguồn + bồi metadata.** Mỗi nguồn có slug riêng cho cùng một
 *    phim. `detail(slug)` thử đúng slug ở từng nguồn; nguồn nào không biết slug đó
 *    thì tìm lại bằng tên + năm rồi lấy slug của chính nó. Nhờ vậy poster/điểm/dàn
 *    diễn viên từ nguồn metadata ghép được vào phim của nguồn phát.
 */
import { httpError } from '../errors.js';
import { checkDetail, checkList, checkTaxonomy, enrich, episodeCount, MATCH_THRESHOLD, matchScore } from './normalize.js';
import type {
  Capability, CatalogFilters, CatalogSource, ListPage, MovieSummary, SourceDetail, SourceHealth, Taxonomy
} from './types.js';

const FAILURE_THRESHOLD = 3;
const COOLDOWN_BASE_MS = 30_000;
const COOLDOWN_MAX_MS = 10 * 60_000;
const SLUG_MAP_LIMIT = 2_000;

interface Health {
  failures: number;
  openUntil: number;
  lastError: string | null;
  lastSuccessAt: number | null;
}

export interface ResolvedDetail extends SourceDetail {
  /** Nguồn đã cấp phần phát được. */
  source: string;
  /** Các nguồn đã bồi thêm metadata. */
  enrichedBy: string[];
  /** false nghĩa là chỉ có metadata, chưa có tập nào phát được. */
  playable: boolean;
}

export class CatalogResolver {
  private readonly health = new Map<string, Health>();
  /** `slug của nguồn gốc` → `{ tên nguồn: slug của nguồn đó }`, để khỏi tìm lại mỗi lần. */
  private readonly slugMap = new Map<string, Record<string, string>>();

  constructor(readonly sources: CatalogSource[]) {
    for (const source of sources) {
      this.health.set(source.name, { failures: 0, openUntil: 0, lastError: null, lastSuccessAt: null });
    }
  }

  get names(): string[] {
    return this.sources.map((source) => source.name);
  }

  /** Nguồn phát được, theo thứ tự ưu tiên. */
  private get playable(): CatalogSource[] {
    return this.sources.filter((source) => source.kind === 'playable');
  }

  private get metadataSources(): CatalogSource[] {
    return this.sources.filter((source) => source.kind === 'metadata');
  }

  capabilities(source: CatalogSource): Capability[] {
    const all: Capability[] = [
      'latest', 'home', 'list', 'search', 'genres', 'byGenre', 'countries',
      'byCountry', 'years', 'byYear', 'actors', 'codes', 'byCode', 'detail'
    ];
    return all.filter((capability) => typeof source[capability] === 'function');
  }

  /** Nguồn có khả năng này và chưa bị tạm ngừng. */
  private candidates(capability: Capability): CatalogSource[] {
    const now = Date.now();
    const able = this.sources.filter((source) => typeof source[capability] === 'function');
    const open = able.filter((source) => (this.health.get(source.name)?.openUntil ?? 0) <= now);
    // Mọi nguồn đều đang bị ngừng: vẫn thử tất cả thay vì trả lỗi ngay. Circuit
    // breaker để tránh chờ vô ích, không phải để tự chặn mình khi không còn đường nào.
    return open.length ? open : able;
  }

  private succeed(name: string) {
    const entry = this.health.get(name);
    if (!entry) return;
    entry.failures = 0;
    entry.openUntil = 0;
    entry.lastError = null;
    entry.lastSuccessAt = Date.now();
  }

  private fail(name: string, error: unknown) {
    const entry = this.health.get(name);
    if (!entry) return;
    entry.failures += 1;
    entry.lastError = error instanceof Error ? error.message : String(error);
    if (entry.failures >= FAILURE_THRESHOLD) {
      const step = entry.failures - FAILURE_THRESHOLD;
      entry.openUntil = Date.now() + Math.min(COOLDOWN_MAX_MS, COOLDOWN_BASE_MS * 2 ** step);
    }
  }

  /**
   * Xương sống của cả lớp này: chạy `run` trên từng nguồn ứng viên, trả về kết quả
   * đầu tiên hợp lệ. `validate` chạy **trong** vòng lặp — nguồn trả 200 nhưng sai
   * shape cũng bị tính là lỗi và rơi xuống nguồn sau, chứ không đẩy dữ liệu rác
   * xuống DB.
   */
  private async firstOf<T>(
    capability: Capability,
    run: (source: CatalogSource) => Promise<unknown>,
    validate: (source: string, value: unknown) => T
  ): Promise<T & { source: string }> {
    const candidates = this.candidates(capability);
    if (!candidates.length) throw httpError(501, `Không có nguồn nào hỗ trợ "${capability}"`);
    const reasons: string[] = [];
    for (const source of candidates) {
      try {
        const value = validate(source.name, await run(source));
        this.succeed(source.name);
        return { ...value, source: source.name };
      } catch (error) {
        this.fail(source.name, error);
        reasons.push(`${source.name}: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`[catalog] ${capability} lỗi ở nguồn ${source.name}:`, (error as Error)?.message);
      }
    }
    throw httpError(502, `Mọi nguồn đều không trả lời được "${capability}" (${reasons.join('; ')})`);
  }

  private list(capability: Capability, run: (source: CatalogSource) => Promise<unknown>) {
    return this.firstOf(capability, run, checkList);
  }

  private taxonomy(capability: Capability, run: (source: CatalogSource) => Promise<unknown>) {
    return this.firstOf(capability, run, checkTaxonomy);
  }

  latest(page: number, limit = 24): Promise<ListPage> {
    return this.list('latest', (source) => source.latest!(page, limit));
  }
  home(filters: CatalogFilters = {}): Promise<ListPage> {
    return this.list('home', (source) => source.home!(filters));
  }
  listBySlug(slug: string, filters: CatalogFilters = {}): Promise<ListPage> {
    return this.list('list', (source) => source.list!(slug, filters));
  }
  search(keyword: string, filters: CatalogFilters = {}): Promise<ListPage> {
    return this.list('search', (source) => source.search!(keyword, filters));
  }
  genres(): Promise<Taxonomy> {
    return this.taxonomy('genres', (source) => source.genres!());
  }
  byGenre(slug: string, filters: CatalogFilters = {}): Promise<ListPage> {
    return this.list('byGenre', (source) => source.byGenre!(slug, filters));
  }
  countries(): Promise<Taxonomy> {
    return this.taxonomy('countries', (source) => source.countries!());
  }
  byCountry(slug: string, filters: CatalogFilters = {}): Promise<ListPage> {
    return this.list('byCountry', (source) => source.byCountry!(slug, filters));
  }
  years(): Promise<Taxonomy> {
    return this.taxonomy('years', (source) => source.years!());
  }
  byYear(year: string, filters: CatalogFilters = {}): Promise<ListPage> {
    return this.list('byYear', (source) => source.byYear!(year, filters));
  }
  actors(): Promise<Taxonomy> {
    return this.taxonomy('actors', (source) => source.actors!());
  }
  codes(): Promise<Taxonomy> {
    return this.taxonomy('codes', (source) => source.codes!());
  }
  byCode(code: string, filters: CatalogFilters = {}): Promise<ListPage> {
    return this.list('byCode', (source) => source.byCode!(code, filters));
  }

  /**
   * Chi tiết một phim, ghép từ nhiều nguồn.
   *
   * Thứ tự có chủ ý: **nguồn phát trước**. Phần người dùng thực sự cần là tập phim,
   * nên phim lấy từ nguồn nào phát được thì bản ghi thuộc nguồn đó; metadata chỉ
   * lấp chỗ trống. Không nguồn phát nào có thì mới trả về bản chỉ-metadata, đánh
   * dấu `playable: false` để phía trên biết đây là mục trong catalog chưa xem được.
   */
  async detail(slug: string): Promise<ResolvedDetail> {
    const reasons: string[] = [];
    let base: { source: string; detail: SourceDetail } | null = null;

    for (const source of this.orderedFor('detail', this.playable)) {
      const found = await this.detailFrom(source, slug, null, reasons);
      if (found && episodeCount(found.episodes)) {
        base = { source: source.name, detail: found };
        break;
      }
      // Nguồn phát trả về phim nhưng không có tập nào (phim mới thêm, chưa có link):
      // giữ làm bản dự phòng, vẫn đi tìm nguồn phát khác.
      if (found && !base) base = { source: source.name, detail: found };
    }

    if (!base) {
      for (const source of this.orderedFor('detail', this.metadataSources)) {
        const found = await this.detailFrom(source, slug, null, reasons);
        if (found) {
          base = { source: source.name, detail: found };
          break;
        }
      }
    }

    if (!base) throw httpError(404, `Không nguồn nào có phim "${slug}" (${reasons.join('; ') || 'không có nguồn hỗ trợ detail'})`);

    let movie = base.detail.movie;
    const enrichedBy: string[] = [];
    for (const source of this.orderedFor('detail', this.sources)) {
      if (source.name === base.source) continue;
      if (isComplete(movie)) break;
      const found = await this.detailFrom(source, slug, movie, reasons);
      if (!found) continue;
      const before = movie;
      movie = enrich(movie, found.movie);
      if (movie !== before && JSON.stringify(movie) !== JSON.stringify(before)) enrichedBy.push(source.name);
    }

    return {
      movie,
      episodes: base.detail.episodes,
      source: base.source,
      enrichedBy,
      playable: episodeCount(base.detail.episodes) > 0
    };
  }

  /**
   * Lấy detail ở một nguồn cụ thể. `reference` khác null nghĩa là đã biết phim
   * này là phim nào — nếu nguồn không hiểu slug thì tìm lại bằng tên + năm.
   */
  private async detailFrom(
    source: CatalogSource,
    slug: string,
    reference: MovieSummary | null,
    reasons: string[]
  ): Promise<SourceDetail | null> {
    const mapped = this.slugMap.get(slug)?.[source.name];
    const attempts = mapped && mapped !== slug ? [mapped] : [slug];
    for (const candidate of attempts) {
      try {
        const detail = checkDetail(source.name, await source.detail!(candidate));
        this.succeed(source.name);
        this.rememberSlug(slug, source.name, detail.movie.slug || candidate);
        return detail;
      } catch (error) {
        reasons.push(`${source.name}: ${(error as Error)?.message ?? error}`);
      }
    }
    if (!reference || typeof source.search !== 'function') {
      // Không có gì để tìm lại: chỉ ghi nhận lỗi, không tính là nguồn chết vì
      // "nguồn này không có phim đó" là câu trả lời hợp lệ.
      return null;
    }
    const reconciled = await this.findSlug(source, reference, reasons);
    if (!reconciled) return null;
    try {
      const detail = checkDetail(source.name, await source.detail!(reconciled));
      this.succeed(source.name);
      this.rememberSlug(slug, source.name, reconciled);
      return detail;
    } catch (error) {
      this.fail(source.name, error);
      reasons.push(`${source.name}: ${(error as Error)?.message ?? error}`);
      return null;
    }
  }

  /** Tìm slug của cùng một phim ở nguồn khác, bằng tên + năm. */
  private async findSlug(source: CatalogSource, reference: MovieSummary, reasons: string[]): Promise<string | null> {
    const keyword = reference.name || reference.originName;
    if (!keyword) return null;
    try {
      const page = checkList(source.name, await source.search!(keyword, { page: 1, limit: 20 }));
      let best: { slug: string; score: number } | null = null;
      for (const item of page.items) {
        const score = matchScore(reference, item);
        if (!best || score > best.score) best = { slug: item.slug, score };
      }
      this.succeed(source.name);
      return best && best.score >= MATCH_THRESHOLD ? best.slug : null;
    } catch (error) {
      this.fail(source.name, error);
      reasons.push(`${source.name} (tìm lại): ${(error as Error)?.message ?? error}`);
      return null;
    }
  }

  private rememberSlug(slug: string, source: string, resolved: string) {
    const entry = this.slugMap.get(slug) ?? {};
    if (entry[source] === resolved) return;
    entry[source] = resolved;
    if (!this.slugMap.has(slug) && this.slugMap.size >= SLUG_MAP_LIMIT) {
      const oldest = this.slugMap.keys().next().value;
      if (oldest !== undefined) this.slugMap.delete(oldest);
    }
    this.slugMap.set(slug, entry);
  }

  /** Nguồn có khả năng này, nguồn đang bị tạm ngừng đẩy xuống cuối chứ không loại bỏ. */
  private orderedFor(capability: Capability, pool: CatalogSource[]): CatalogSource[] {
    const now = Date.now();
    const able = pool.filter((source) => typeof source[capability] === 'function');
    return [
      ...able.filter((source) => (this.health.get(source.name)?.openUntil ?? 0) <= now),
      ...able.filter((source) => (this.health.get(source.name)?.openUntil ?? 0) > now)
    ];
  }

  /** Dữ liệu cho `GET /api/providers`. */
  status(): SourceHealth[] {
    const now = Date.now();
    return this.sources.map((source) => {
      const entry = this.health.get(source.name)!;
      return {
        name: source.name,
        kind: source.kind,
        capabilities: this.capabilities(source),
        healthy: entry.openUntil <= now,
        failures: entry.failures,
        openUntil: entry.openUntil > now ? new Date(entry.openUntil).toISOString() : null,
        lastError: entry.lastError,
        lastSuccessAt: entry.lastSuccessAt ? new Date(entry.lastSuccessAt).toISOString() : null
      };
    });
  }
}

/** Đủ metadata thì dừng gọi thêm nguồn — mỗi nguồn là một request thật. */
function isComplete(movie: MovieSummary): boolean {
  return Boolean(movie.posterUrl && movie.description && movie.year && movie.rating && movie.actors.length);
}
