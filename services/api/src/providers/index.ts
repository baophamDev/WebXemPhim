/**
 * Nơi quyết định nguồn nào được bật và theo thứ tự nào.
 *
 * Cấu hình bằng `CATALOG_SOURCES`, danh sách tên cách nhau bằng dấu phẩy, **thứ
 * tự là ưu tiên**:
 *
 *   CATALOG_SOURCES=vsmov,tmdb    nguồn phát trước, TMDB bồi metadata
 *   CATALOG_SOURCES=tmdb          chỉ catalog metadata, không phát
 *
 * `CATALOG_PROVIDER` (số ít) của bản cũ vẫn đọc được để lần deploy tới không cần
 * đổi biến môi trường trước — coi như danh sách một phần tử.
 *
 * Nguồn thiếu cấu hình thì **im lặng bỏ qua** chứ không làm sập tiến trình: TMDB
 * không có khoá API là chuyện bình thường ở máy dev, và không có lý do gì để cả
 * API không khởi động được vì thiếu một nguồn bồi metadata. Nhưng bật đúng tên mà
 * nguồn không tồn tại thì vẫn ném — đó là lỗi chính tả trong cấu hình, im lặng
 * chỉ khiến người ta đi tìm ở chỗ khác.
 *
 * `mdl` (MyDramaList) có tên trong bảng nhưng `source: null`: chưa có API công
 * khai nên chưa viết adapter. Khai báo sẵn để `/api/providers` nói được "có nguồn
 * này, đang thiếu khoá" và web hiện nó mờ — thêm sau chỉ là điền `source`.
 */
import { CatalogResolver } from './resolver.js';
import { tmdb, tmdbEnabled } from './tmdb.js';
import { tvdb, tvdbEnabled } from './tvdb.js';
import type { CatalogSource, InactiveSource, SourceKind } from './types.js';
import { vsmov } from './vsmov.js';

interface Entry {
  /** null = đã đặt tên nhưng chưa có adapter. */
  source: CatalogSource | null;
  kind: SourceKind;
  enabled: boolean;
  hint: string;
}

const AVAILABLE: Record<string, Entry> = {
  vsmov: { source: vsmov, kind: 'playable', enabled: true, hint: '' },
  tmdb: { source: tmdb, kind: 'metadata', enabled: tmdbEnabled, hint: 'thiếu TMDB_ACCESS_TOKEN hoặc TMDB_API_KEY' },
  tvdb: { source: tvdb, kind: 'metadata', enabled: tvdbEnabled, hint: 'thiếu TVDB_API_KEY' },
  mdl: {
    source: null,
    kind: 'metadata',
    enabled: false,
    hint: 'MyDramaList chưa mở API công khai — cần xin khoá ở mydramalist.com/api_request'
  }
};

const DEFAULT_ORDER = 'vsmov,tmdb,tvdb';

function requested(): string[] {
  const raw = process.env.CATALOG_SOURCES ?? process.env.CATALOG_PROVIDER ?? DEFAULT_ORDER;
  const names = raw.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
  return [...new Set(names)];
}

function build(): CatalogSource[] {
  const enabled: CatalogSource[] = [];
  for (const name of requested()) {
    const entry = AVAILABLE[name];
    if (!entry) throw new Error(`Nguồn catalog không tồn tại: "${name}" (có: ${Object.keys(AVAILABLE).join(', ')})`);
    if (!entry.enabled || !entry.source) {
      console.warn(`[catalog] bỏ qua nguồn ${name}: ${entry.hint}`);
      continue;
    }
    enabled.push(entry.source);
  }
  if (!enabled.length) {
    // Không còn nguồn nào bật được: vẫn cắm vsmov vào để API mở cổng và các đường
    // có fallback về DB (menu điều hướng, /api/movies) tiếp tục phục vụ được.
    console.warn('[catalog] không nguồn nào được bật, quay về vsmov');
    return [vsmov];
  }
  return enabled;
}

export const catalog = new CatalogResolver(build());

/**
 * Nguồn có tên nhưng không nằm trong resolver — kèm lý do. Web dùng danh sách này
 * để hiện mục mờ trong bộ chọn nguồn: biết nguồn tồn tại và biết thiếu gì thì hơn
 * là không thấy gì cả.
 */
export function inactiveSources(): InactiveSource[] {
  const active = new Set(catalog.names);
  return Object.entries(AVAILABLE)
    .filter(([name]) => !active.has(name))
    .map(([name, entry]) => ({
      name,
      kind: entry.kind,
      hint: entry.hint || (entry.source ? 'chưa bật trong CATALOG_SOURCES' : 'chưa có adapter')
    }));
}

console.log(`[catalog] nguồn đang bật (theo ưu tiên): ${catalog.names.join(' → ')}`);

export type {
  CatalogFilters, CatalogSource, InactiveSource, ListPage, MovieSummary, SourceDetail, SourceHealth, Taxonomy
} from './types.js';
export type { ResolvedDetail } from './resolver.js';
