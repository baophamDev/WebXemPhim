/**
 * Nhặt lại những request mà `index.html` đã bắn đi trước khi bundle này về máy.
 *
 * Phía bắn đi là mấy dòng script cổ điển trong `apps/web/index.html`: nó đọc
 * `location.pathname`, nhận ra đang mở trang chủ / trang phim / trang xem rồi gọi
 * API ngay trong lúc trình duyệt còn đang đọc HTML — tức là **trước** khi bundle
 * được tải và chạy. Đây là chỗ RTK Query nhận lại kết quả đó thay vì hỏi lần nữa.
 *
 * Nguyên tắc: mọi thứ ở đây đều là *đầu cơ*. Không khớp, quá cũ, hay chết giữa
 * đường thì trả `null` và đường thường của `fetchBaseQuery` chạy như chưa có gì.
 * Không được có nhánh nào làm app hiện lỗi mà bình thường nó không hiện.
 */

/** Câu trả lời thô của một request bắn trước — chưa parse, vì `text()` chỉ đọc được một lần. */
export interface BootReply {
  status: number;
  ok: boolean;
  text: string;
}

export interface BootRequest {
  /** URL đúng như script trong index.html đã gọi. */
  url: string;
  /** Date.now() lúc bắn đi, để biết nó còn mới không. */
  at: number;
  promise: Promise<BootReply>;
}

declare global {
  interface Window {
    __BOOT__?: BootRequest[];
  }
}

/**
 * Quá mốc này thì thà hỏi lại. Người dùng mở trang rồi đi làm việc khác mười
 * phút, quay lại bấm một cú làm RTK Query gọi endpoint đó: lúc đó nhặt câu trả
 * lời của mười phút trước là hiển thị dữ liệu cũ mà không ai yêu cầu.
 */
const TTL_MS = 30_000;

/**
 * Phần của `FetchArgs` (RTK Query) mà chỗ này cần. Khai lại thay vì import type
 * từ RTK để module này không dính gì tới thư viện — nhờ vậy test chạy được nó sau
 * khi biên dịch một file duy nhất, không cần bundler.
 */
export interface BootArgs {
  url: string;
  params?: Record<string, unknown>;
  method?: string;
}

/**
 * URL đầy đủ mà `fetchBaseQuery` sắp gọi.
 *
 * Ở cùng file với `claimBoot` là có chủ ý: đây là *một nửa* của phép so khớp (nửa
 * kia là chuỗi do `index.html` nối bằng tay). Để nó ở api.ts thì hai nửa nằm hai
 * nơi và không có cách nào kiểm chứng chúng vẫn khớp nhau.
 *
 * Không cần xếp thứ tự tham số ở đây — `shape()` bên dưới lo việc đó.
 */
export function bootUrl(baseUrl: string, args: string | BootArgs): string {
  const path = typeof args === 'string' ? args : args.url;
  const params = typeof args === 'string' ? undefined : args.params;
  const pairs = Object.entries(params ?? {}).filter(([, value]) => value !== undefined);
  const query = pairs.length ? new URLSearchParams(pairs.map(([key, value]) => [key, String(value)])).toString() : '';
  return `${baseUrl}${path}${query ? `${path.includes('?') ? '&' : '?'}${query}` : ''}`;
}

/**
 * Dạng chuẩn hoá của một URL để so khớp: bỏ thứ tự tham số ra khỏi phương trình.
 *
 * Cần vì hai bên dựng URL theo hai cách khác nhau — `index.html` nối chuỗi bằng
 * tay, `fetchBaseQuery` xếp từ object `params` — nên `?page=1&limit=24&source=x`
 * và `?limit=24&page=1&source=x` là **cùng một request** dù chuỗi khác nhau.
 *
 * Gộp cả dấu `/` lặp: `apiBaseUrl` trong api.ts cắt một dấu `/` cuối, script ở
 * index.html cắt hết, nên `VITE_API_URL` đặt kèm hai dấu `/` sẽ cho `/api//catalog`
 * ở một bên và `/api/catalog` ở bên kia — cùng một endpoint với Express, chỉ khác
 * chuỗi. Không gộp thì cấu hình lệch một ký tự làm cả cơ chế này im lặng vô hiệu.
 */
function shape(url: string): string | null {
  try {
    const parsed = new URL(url, typeof location === 'undefined' ? 'http://localhost' : location.origin);
    const params = [...parsed.searchParams].map(([key, value]) => `${key}=${value}`).sort().join('&');
    const path = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return `${parsed.origin}${path}?${params}`;
  } catch {
    return null;
  }
}

/**
 * Lấy câu trả lời đã bắn trước cho đúng URL này, nếu còn dùng được.
 *
 * Dùng một lần: lấy ra là bỏ khỏi hàng, kể cả khi nó đã quá cũ. Giữ lại thì một
 * lần `refetch()` sau đó sẽ nhận lại đúng dữ liệu cũ đó và người dùng bấm "thử
 * lại" mãi vẫn thấy y nguyên.
 */
export function claimBoot(url: string): Promise<BootReply> | null {
  const queue = typeof window === 'undefined' ? undefined : window.__BOOT__;
  if (!queue?.length) return null;
  const wanted = shape(url);
  if (!wanted) return null;
  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    if (shape(entry.url) !== wanted) continue;
    queue.splice(index, 1);
    return Date.now() - entry.at > TTL_MS ? null : entry.promise;
  }
  return null;
}
