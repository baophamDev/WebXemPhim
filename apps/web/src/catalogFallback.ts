/**
 * Dịch route catalog của API mình sang request tương ứng của VSMOV.
 *
 * Vì sao có file này: API là một chặng nữa có thể chết — service bị xoá, hết credit,
 * hay IP datacenter bị VSMOV chặn 403 (chuyện đã xảy ra với Railway). Nhưng VSMOV
 * trả `Access-Control-Allow-Origin: *` nên **trình duyệt** gọi thẳng được, lúc đó
 * trang chủ, danh sách, thể loại/quốc gia/năm và menu vẫn dựng được — chỉ những gì
 * thuộc về *kho* (lưu phim, xem tiếp, phụ đề, tìm trong DB) mới thật sự cần API.
 *
 * Hàm ở đây thuần và **không import gì**: nhận URL của request rồi trả về việc phải
 * làm, để test biên dịch được một file duy nhất (test/catalogFallback.test.mjs) và
 * để bảng route khớp `catalogUrl()` trong `api.ts` thành một chỗ đọc được.
 *
 * Bảng lọc dưới đây chép đúng luật của nguồn đã đối chiếu ở
 * `services/api/src/providers/types.ts`: nhóm `/danh-sach/:slug` bỏ qua `limit`,
 * `/quoc-gia/:slug` bỏ `year`/`country`, `/nam/:slug` bỏ `country`/`category`.
 * Gửi thừa tham số không làm sai kết quả, nhưng làm URL khác đi — mà URL khác thì
 * bộ nhớ đệm của nguồn (và của `claimBoot`) coi là câu hỏi mới.
 */

/** Phần `FetchArgs` của RTK Query mà chỗ này cần — khai lại để không import thư viện. */
export interface FallbackArgs {
  url: string;
  params?: Record<string, unknown>;
  method?: string;
}

export type CatalogTarget =
  /** Một trang danh sách phim; `limit` dùng khi nguồn không trả phân trang. */
  | { kind: 'list'; url: string; limit: number }
  /** Danh mục dùng cho dropdown: thể loại, quốc gia, năm... */
  | { kind: 'taxonomy'; url: string }
  /** Cả ba danh mục của thanh menu trong một lượt. */
  | { kind: 'navigation' }
  /** Chi tiết một phim kèm nhóm tập phát được. */
  | { kind: 'detail'; slug: string };

/**
 * Tham số nguồn thật sự đọc, theo từng nhóm endpoint. `page` luôn có mặt.
 */
const FILTERS = {
  /** `/danh-sach/:slug` — tự ép limit riêng nên không gửi `limit`. */
  list: ['page', 'type', 'status'],
  search: ['page', 'limit', 'year', 'country', 'category', 'type', 'status'],
  genre: ['page', 'limit', 'year', 'country', 'category', 'type', 'status'],
  country: ['page', 'limit', 'category', 'type', 'status'],
  year: ['page', 'limit', 'type', 'status']
} as const;

/** Danh mục không có route con: `/catalog/genres` hỏi thẳng nguồn. */
const TAXONOMY: Record<string, string> = {
  genres: '/the-loai',
  countries: '/quoc-gia',
  years: '/nam',
  actors: '/dien-vien',
  codes: '/code'
};

/** Danh sách theo một giá trị trong đường dẫn (`/the-loai/hanh-dong`, `/nam/2024`). */
const BY_VALUE: Record<string, { path: string; filters: readonly string[] }> = {
  genres: { path: '/the-loai', filters: FILTERS.genre },
  countries: { path: '/quoc-gia', filters: FILTERS.country },
  years: { path: '/nam', filters: FILTERS.year },
  codes: { path: '/danh-sach', filters: FILTERS.list }
};

/**
 * API không trả lời được — chứ không phải "API trả lời rằng không có dữ liệu".
 *
 * `404` nằm trong danh sách vì đó chính là thứ Railway trả khi service không còn
 * (`{"code":404,"message":"Application not found"}`). `PARSING_ERROR` là cảnh Vercel
 * rewrite mọi đường dẫn về `index.html`: request nhận HTML nên parse JSON đổ, và UI
 * hiểu thành "API ngoại tuyến".
 */
export function apiUnavailable(status: number | string): boolean {
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR' || status === 'PARSING_ERROR') return true;
  const code = Number(status);
  if (!Number.isFinite(code)) return false;
  return code === 404 || code >= 500;
}

/** `?a=1&b=2`, bỏ tham số rỗng và `undefined` — `type=` là một giá trị lạ với nguồn. */
function queryText(keys: readonly string[], read: (key: string) => unknown, extra: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (text) search.set(key, text);
  };
  Object.keys(extra).forEach((key) => put(key, extra[key]));
  keys.forEach((key) => put(key, read(key)));
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Slug đi vào URL của nguồn y như cách `api.ts` dựng URL cho API mình. */
function segment(value: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

export function catalogTarget(args: string | FallbackArgs): CatalogTarget | null {
  if (typeof args !== 'string' && args.method && args.method.toUpperCase() !== 'GET') return null;
  const raw = typeof args === 'string' ? args : args.url;
  const params = typeof args === 'string' ? {} : args.params ?? {};
  const cut = raw.indexOf('?');
  const path = (cut === -1 ? raw : raw.slice(0, cut)).replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  const search = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
  const read = (key: string) => params[key] ?? search.get(key) ?? undefined;

  const match = /^\/catalog\/([^/]+)(?:\/(.+))?$/.exec(path);
  if (!match) return null;
  const section = match[1];
  const value = match[2] ? segment(match[2]) : null;
  const limit = Math.max(1, Math.trunc(Number(read('limit')) || 24));

  if (section === 'home') return { kind: 'list', url: `/danh-sach/phim-moi-cap-nhat${queryText(FILTERS.list, read)}`, limit };
  if (section === 'navigation') return { kind: 'navigation' };
  if (section === 'movies') return value ? { kind: 'detail', slug: value } : null;
  if (section === 'lists') return value ? { kind: 'list', url: `/danh-sach/${value}${queryText(FILTERS.list, read)}`, limit } : null;
  if (section === 'search') {
    const keyword = String(read('q') ?? '').trim();
    return keyword ? { kind: 'list', url: `/tim-kiem${queryText(FILTERS.search, read, { keyword })}`, limit } : null;
  }
  if (section in TAXONOMY) {
    if (!value) return { kind: 'taxonomy', url: TAXONOMY[section] };
    // `actors` chỉ có danh mục, không có đường "phim theo diễn viên" bên nguồn.
    const route = BY_VALUE[section];
    if (!route) return null;
    return { kind: 'list', url: `${route.path}/${value}${queryText(route.filters, read)}`, limit };
  }
  return null;
}
