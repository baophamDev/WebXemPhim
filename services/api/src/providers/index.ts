/**
 * Resolver catalog: VSMOV là nguồn chính, KKPhim thay khi VSMOV chết, NguonC
 * bồi tập embed khi cả hai đều không có luồng phát.
 *
 * VSMOV có hai kiểu "chết": chặn IP datacenter (Railway từng bị 403) và trả
 * `link_m3u8` rỗng ở mọi tập (embed chỉ còn player giả). Nên tầng này không chỉ
 * rơi xuống nguồn sau khi nguồn trước **lỗi**, mà còn khi nguồn trước trả về
 * **rỗng** (list/taxonomy) hoặc **không có luồng phát được** (detail).
 *
 * Luật bồi dữ liệu:
 * - Danh sách/danh mục: nguồn đầu có items thì dùng luôn; rỗng hoặc lỗi thì hỏi
 *   nguồn kế tiếp. Hết nguồn mà vẫn không có gì thì ném lỗi cuối cùng để route
 *   rơi tiếp xuống DB (`homeWithFallback`, `taxonomyWithFallback`...).
 * - Chi tiết: ưu tiên bản có `link_m3u8` thật (VSMOV rồi KKPhim, tìm bản tương
 *   ứng theo slug rồi theo tên). Không nguồn nào có luồng phát thì hỏi NguonC —
 *   nguồn chỉ có embed, nhưng là embed thật — và giữ metadata của nguồn chính,
 *   chỉ thay danh sách tập. Cuối cùng vẫn không có gì thì trả bản VSMOV (còn
 *   metadata) thay vì mất cả trang.
 */
import { checkDetail, checkList, checkTaxonomy } from './normalize.js';
import type { CatalogFilters, SourceDetail } from './types.js';
import { kkphim } from './kkphim.js';
import { nguonc } from './nguonc.js';
import { vsmov } from './vsmov.js';

/** Thứ tự ưu tiên: nguồn đầu trả lời được thì không hỏi nguồn sau. */
const PROVIDERS = [vsmov, kkphim, nguonc] as const;

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Hỏi lần lượt từng nguồn cho tới khi có câu trả lời "dùng được" (`ok`). Lỗi
 * của nguồn trước không làm đổ cả chuỗi — chỉ khi hết nguồn mới ném lỗi cuối.
 */
async function resolve<T>(
  action: string,
  run: (provider: (typeof PROVIDERS)[number]) => Promise<T>,
  ok: (value: T) => boolean
): Promise<{ value: T; source: string }> {
  let lastError: unknown = null;
  for (const provider of PROVIDERS) {
    try {
      const value = await run(provider);
      if (ok(value)) return { value, source: provider.name };
      console.warn(`[catalog] ${provider.name} không có dữ liệu cho ${action}, thử nguồn kế tiếp`);
    } catch (error) {
      lastError = error;
      console.warn(`[catalog] ${provider.name} lỗi khi ${action}: ${describe(error)}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Không nguồn nào trả ${action}`);
}

const hasItems = (value: { items: unknown[] }) => value.items.length > 0;

/** Một detail "phát được" là có ít nhất một tập kèm link m3u8 thật. */
const playable = (detail: SourceDetail) =>
  detail.episodes.some((group) => group.server_data.some((entry) => entry.link_m3u8));

/** Slug người dùng mở là khoá bản ghi trong DB; slug của nguồn chỉ là đường dẫn nội bộ. */
const withSlug = (detail: SourceDetail, slug: string): SourceDetail =>
  detail.movie.slug === slug ? detail : { ...detail, movie: { ...detail.movie, slug } };

export const catalog = {
  names: PROVIDERS.map((provider) => provider.name),
  latest: async (page: number) => {
    const { value, source } = await resolve('danh sách mới cập nhật', (provider) => provider.latest(page), hasItems);
    return { ...checkList(source, value), source };
  },
  home: async (filters: CatalogFilters = {}) => {
    const { value, source } = await resolve('trang chủ', (provider) => provider.home(filters), hasItems);
    return { ...checkList(source, value), source };
  },
  listBySlug: async (slug: string, filters: CatalogFilters = {}) => {
    const { value, source } = await resolve(`danh sách "${slug}"`, (provider) => provider.list(slug, filters), hasItems);
    return { ...checkList(source, value), source };
  },
  search: async (keyword: string, filters: CatalogFilters = {}) => {
    const { value, source } = await resolve(`tìm kiếm "${keyword}"`, (provider) => provider.search(keyword, filters), hasItems);
    return { ...checkList(source, value), source };
  },
  genres: async () => {
    const { value, source } = await resolve('thể loại', (provider) => provider.genres(), hasItems);
    return { ...checkTaxonomy(source, value), source };
  },
  byGenre: async (slug: string, filters: CatalogFilters = {}) => {
    const { value, source } = await resolve(`phim theo thể loại "${slug}"`, (provider) => provider.byGenre(slug, filters), hasItems);
    return { ...checkList(source, value), source };
  },
  countries: async () => {
    const { value, source } = await resolve('quốc gia', (provider) => provider.countries(), hasItems);
    return { ...checkTaxonomy(source, value), source };
  },
  byCountry: async (slug: string, filters: CatalogFilters = {}) => {
    const { value, source } = await resolve(`phim theo quốc gia "${slug}"`, (provider) => provider.byCountry(slug, filters), hasItems);
    return { ...checkList(source, value), source };
  },
  years: async () => {
    // KKPhim không có endpoint danh sách năm (trả rỗng), nên khi VSMOV chết thì
    // `taxonomyWithFallback` ở server sẽ dựng menu năm từ DB.
    const { value, source } = await resolve('năm phát hành', (provider) => provider.years(), hasItems);
    return { ...checkTaxonomy(source, value), source };
  },
  byYear: async (year: string, filters: CatalogFilters = {}) => {
    const { value, source } = await resolve(`phim theo năm "${year}"`, (provider) => provider.byYear(year, filters), hasItems);
    return { ...checkList(source, value), source };
  },
  actors: async () => {
    const { value, source } = await resolve('diễn viên', (provider) => provider.actors(), hasItems);
    return { ...checkTaxonomy(source, value), source };
  },
  codes: async () => {
    const { value, source } = await resolve('mã danh sách', (provider) => provider.codes(), hasItems);
    return { ...checkTaxonomy(source, value), source };
  },
  byCode: async (code: string, filters: CatalogFilters = {}) => {
    const { value, source } = await resolve(`danh sách theo mã "${code}"`, (provider) => provider.byCode(code, filters), hasItems);
    return { ...checkList(source, value), source };
  },
  detail: async (slug: string, report?: (stage: 'loading', source: string | null) => void) => {
    report?.('loading', vsmov.name);
    let primary: SourceDetail | null = null;
    let primaryError: unknown = null;
    try {
      primary = checkDetail(vsmov.name, await vsmov.detail(slug));
    } catch (error) {
      primaryError = error;
      console.warn(`[catalog] ${vsmov.name} lỗi khi lấy chi tiết "${slug}": ${describe(error)}`);
    }
    if (primary && playable(primary)) return { ...primary, source: vsmov.name };

    report?.('loading', kkphim.name);
    let streams: SourceDetail | null = null;
    try {
      // Có metadata VSMOV thì tìm bản tương ứng theo slug/tên; VSMOV chết hẳn thì
      // thử thẳng slug người dùng mở (lúc này catalog cũng do KKPhim trả về).
      const found = primary
        ? await kkphim.detailLike({
            slug: primary.movie.slug, name: primary.movie.name,
            originName: primary.movie.originName, year: primary.movie.year
          })
        : await kkphim.detail(slug);
      if (found) {
        streams = checkDetail(kkphim.name, withSlug(found, slug));
        // Có luồng phát thì thắng ngay; không thì để NguonC thử bồi tập embed.
        if (playable(streams)) return { ...streams, source: kkphim.name };
      }
    } catch (error) {
      console.warn(`[catalog] ${kkphim.name} không có bản thay thế cho "${slug}": ${describe(error)}`);
    }

    // Chưa nguồn nào có luồng phát: hỏi NguonC. Nguồn này chỉ có embed, nhưng là
    // embed thật — hơn hẳn player giả mà VSMOV đang trả — nên thay danh sách tập,
    // còn metadata thì giữ của nguồn chính (NguonC thiếu năm, điểm, tmdb).
    report?.('loading', nguonc.name);
    try {
      const meta = primary ?? streams;
      const found = meta
        ? await nguonc.detailLike({
            slug: meta.movie.slug, name: meta.movie.name,
            originName: meta.movie.originName, year: meta.movie.year
          })
        : await nguonc.detail(slug);
      if (found) {
        const checked = checkDetail(nguonc.name, withSlug(found, slug));
        if (checked.episodes.length) return { ...checked, movie: meta ? meta.movie : checked.movie, source: nguonc.name };
        if (!meta) return { ...checked, source: nguonc.name };
      }
    } catch (error) {
      console.warn(`[catalog] ${nguonc.name} không có bản thay thế cho "${slug}": ${describe(error)}`);
    }

    if (primary) return { ...primary, source: vsmov.name };
    if (streams) return { ...streams, source: kkphim.name };
    throw primaryError instanceof Error ? primaryError : new Error(`Không nguồn nào trả chi tiết phim "${slug}"`);
  }
};

console.log(`[catalog] nguồn: ${catalog.names.join(' → ')} (nguồn sau là dự phòng)`);

export type {
  CatalogFilters, ListPage, MovieSummary, SourceDetail, Taxonomy, CatalogDetail
} from './types.js';
