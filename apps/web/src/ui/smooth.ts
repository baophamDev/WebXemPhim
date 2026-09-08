/**
 * Cầu nối cuộn mượt không kéo Lenis vào mọi chunk.
 *
 * Trang chủ tạo một Lenis duy nhất để cuộn bánh xe có quán tính; các nút điều
 * hướng trong trang (về đầu trang, về trang mới...) muốn đi theo quỹ đạo đó
 * chứ không tự `scrollTo({behavior:'smooth'})` — nhảy độc lập với Lenis là bị
 * đánh về đầu ngay sau đó. Module này chỉ giữ một tham chiếu, không import
 * gì nặng, nên mọi trang dùng được mà không phình bundle.
 */

type Scroller = { scrollTo: (target: number | string | HTMLElement, options?: { offset?: number; immediate?: boolean; duration?: number }) => void };

let scroller: Scroller | null = null;

/** Đăng ký bộ cuộn đang hoạt động (trang chủ gọi khi Lenis sẵn sàng). */
export function registerScroller(next: Scroller | null) {
  scroller = next;
}

/** Cuộn về vị trí, mượt qua Lenis nếu có, rơi về cuộn gốc khi không. */
export function smoothScrollTo(target: number | string | HTMLElement, options?: { offset?: number; immediate?: boolean; duration?: number }) {
  if (scroller) scroller.scrollTo(target, options);
  else window.scrollTo({ top: typeof target === 'number' ? target + (options?.offset ?? 0) : 0, behavior: options?.immediate ? 'auto' : 'smooth' });
}
