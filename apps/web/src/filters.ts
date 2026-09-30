/**
 * Nguồn duy nhất cho bộ lọc của trang Khám Phá: năm khoá lọc, hai nhóm cố định
 * (định dạng, trạng thái), cách ghi cả bộ vào URL và cách dựng link cho menu
 * "Khám phá" trên navigator.
 *
 * Vì sao tách ra file riêng: `browseHref` là bảng dịch giữa giá trị lọc và đường
 * dẫn — lệch một chữ là im lặng, bấm vào ra một trang danh sách không lọc gì cả.
 * File **không import gì chạy được** (chỉ import type, bị xoá khi biên dịch) nên
 * test dịch được một file duy nhất, như `catalogFallback.ts`.
 */
import type { CatalogKind, TaxonomyItem } from './types';

/** Năm khoá lọc của trang Khám Phá; nút "Áp dụng" ghi cả bộ trong một lượt. */
export const FILTER_KEYS = ['category', 'country', 'year', 'type', 'status'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Record<FilterKey, string>;

export const emptyFilters = (): Filters => ({ category: '', country: '', year: '', type: '', status: '' });

/** Trang danh sách trung tính — đích về khi bỏ tiêu chí đang ghim ở đường dẫn. */
export const BROWSE_HOME = '/browse/list/phim-moi-cap-nhat';

/** Năm nhóm của menu "Khám phá" — tên gọi theo cách người xem nghĩ. */
export type DiscoverGroup = 'genre' | 'country' | 'year' | 'format' | 'status';

/**
 * Trang thể loại/quốc gia/năm ghim tiêu chí vào **đường dẫn** thay vì query.
 * Bảng này nói trang nào ghim khoá lọc nào, và nhóm tương ứng trên menu Khám phá.
 */
export const ROUTE_FILTER: Partial<Record<CatalogKind, { key: FilterKey; group: DiscoverGroup }>> = {
  genre: { key: 'category', group: 'genre' },
  country: { key: 'country', group: 'country' },
  year: { key: 'year', group: 'year' }
};

/** Giá trị `type` phải khớp `z.enum` của API (services/api/src/server.ts). */
export const TYPE_OPTIONS: TaxonomyItem[] = [
  { id: 'single', name: 'Phim lẻ', slug: 'single', thumbUrl: null },
  { id: 'series', name: 'Phim bộ', slug: 'series', thumbUrl: null },
  { id: 'hoathinh', name: 'Hoạt hình', slug: 'hoathinh', thumbUrl: null },
  { id: 'tvshows', name: 'TV Shows', slug: 'tvshows', thumbUrl: null }
];

/** Giá trị `status` cũng phải khớp `z.enum` của API. */
export const STATUS_OPTIONS: TaxonomyItem[] = [
  { id: 'ongoing', name: 'Đang chiếu', slug: 'ongoing', thumbUrl: null },
  { id: 'completed', name: 'Hoàn thành', slug: 'completed', thumbUrl: null },
  { id: 'trailer', name: 'Trailer', slug: 'trailer', thumbUrl: null }
];

/**
 * Đường dẫn cho một giá trị trong menu "Khám phá".
 *
 * Thể loại/quốc gia/năm đi vào **đường dẫn** (`/browse/genre/:slug`) vì đó là
 * route riêng của catalog — nguồn nào cũng đọc. Còn định dạng/trạng thái là bộ
 * lọc của endpoint danh sách nên đi vào query, đúng như `readFilters` đọc.
 */
export function browseHref(kind: DiscoverGroup, item: { slug: string }): string {
  const slug = encodeURIComponent(item.slug);
  if (kind === 'genre') return `/browse/genre/${slug}`;
  if (kind === 'country') return `/browse/country/${slug}`;
  if (kind === 'year') return `/browse/year/${slug}`;
  if (kind === 'format') return `${BROWSE_HOME}?type=${slug}`;
  return `${BROWSE_HOME}?status=${slug}`;
}

/**
 * `useParams` trả nguyên đoạn trên URL (react-router không giải mã tham số), còn
 * slug trong danh mục là chữ đã giải mã. Chuỗi hỏng định dạng thì giữ nguyên,
 * không để một URL lạ làm trắng trang.
 */
export function decodeRouteValue(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Bộ lọc đang nằm trên URL. */
export function readFilters(params: URLSearchParams): Filters {
  return {
    category: params.get('category') ?? '',
    country: params.get('country') ?? '',
    year: params.get('year') ?? '',
    type: params.get('type') ?? '',
    status: params.get('status') ?? ''
  };
}

/** Bộ lọc người xem đang thấy: URL cộng tiêu chí mà đường dẫn đã ghim sẵn. */
export function activeFilters(kind: CatalogKind, value: string, params: URLSearchParams): Filters {
  const filters = readFilters(params);
  const carried = ROUTE_FILTER[kind];
  if (carried && !filters[carried.key]) filters[carried.key] = decodeRouteValue(value);
  return filters;
}

/** Bản nháp đã khác bản đang áp dụng chưa — nút "Áp dụng" chỉ bật khi đã khác. */
export function filtersChanged(draft: Filters, applied: Filters): boolean {
  return FILTER_KEYS.some((key) => draft[key] !== applied[key]);
}

/** Không còn tiêu chí nào để xoá. */
export function filtersEmpty(filters: Filters): boolean {
  return FILTER_KEYS.every((key) => !filters[key]);
}

/**
 * Ghi trọn bộ lọc vào query trong một lượt và bỏ `page` để về trang đầu. Tiêu chí
 * đã nằm ở đường dẫn (`carried`) không được ghi lại thành query: gửi cả hai chỗ
 * là nguồn hiểu thành hai điều kiện chồng nhau.
 */
export function withFilters(params: URLSearchParams, filters: Filters, carried: FilterKey[] = []): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of FILTER_KEYS) {
    if (!carried.includes(key) && filters[key]) next.set(key, filters[key]);
    else next.delete(key);
  }
  next.delete('page');
  return next;
}

/** Bấm "Áp dụng" thì đi đâu: đổi hẳn route, hay chỉ đổi query của trang hiện tại. */
export type FilterTarget = { kind: 'search'; params: URLSearchParams } | { kind: 'path'; path: string };

/**
 * Đích đến của nút "Áp dụng".
 *
 * Trên trang danh sách, cả bộ lọc đi vào query như thường. Nhưng trang thể
 * loại/quốc gia/năm đã ghim tiêu chí vào đường dẫn: đổi tiêu chí đó phải **đổi
 * route** (bỏ trắng thì về danh sách trung tính), còn giữ nguyên thì không được
 * ghi nó vào query nữa.
 */
export function commitFilters(kind: CatalogKind, value: string, params: URLSearchParams, draft: Filters): FilterTarget {
  const carried = ROUTE_FILTER[kind];
  const picked = carried ? draft[carried.key] : '';
  if (carried && picked !== decodeRouteValue(value)) {
    const query = withFilters(params, draft, [carried.key]).toString();
    const path = picked ? browseHref(carried.group, { slug: picked }) : BROWSE_HOME;
    return { kind: 'path', path: query ? `${path}?${query}` : path };
  }
  return { kind: 'search', params: withFilters(params, draft, carried ? [carried.key] : []) };
}
