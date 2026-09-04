/**
 * Hai chunk nóng nhất của app, khai báo ở một chỗ duy nhất.
 *
 * Vì sao không để `import()` ngay tại chỗ dùng: mỗi chunk ở đây được nạp từ **hai
 * nơi** — `App.tsx` nạp khi route đổi, còn thẻ phim và link tập nạp trước ngay lúc
 * `pointerdown`. Cùng một specifier thì bundler gom ra cùng một chunk và trình
 * duyệt dùng lại đúng module đã tải; viết tay `import()` ở hai nơi thì sớm muộn
 * lệch đường dẫn, thành hai chunk gần giống nhau mà không ai thấy gì sai.
 *
 * Vì sao hâm nóng: `React.lazy` chỉ bắt đầu tải chunk **sau khi** route đã đổi,
 * nên cú bấm nào cũng có một quãng trống chờ file JS về trước khi trang mới kịp
 * vẽ gì. `pointerdown` xảy ra trước `click` (tức trước lúc router đổi trang) nên
 * chunk thường về xong trước khi có người nhìn — xem thêm `ui/cards.tsx`.
 */

export const loadDetail = () => import('./pages/Detail');
export const loadWatch = () => import('./pages/Watch');

/** Engine phát HLS. Nặng hơn cả phần còn lại của trang cộng lại — xem `needsPlayerEngine`. */
export const loadPlayerEngine = () => import('hls.js');

/** Tải đầu cơ: lỗi thì im lặng, vì lát nữa đường thường sẽ tự thử lại và tự báo. */
function start(load: () => Promise<unknown>) {
  load().catch(() => {});
}

/**
 * Trình duyệt tự phát được HLS (Safari/iOS, một phần TV) thì hls.js là mấy trăm
 * KB tải về để không dùng gì: `Watch.tsx` đi nhánh `video.src` trong trường hợp
 * đó. Hỏi một lần rồi nhớ, vì mỗi lần hỏi là một lần dựng thẻ <video>.
 */
let native: boolean | null = null;
function needsPlayerEngine() {
  if (typeof document === 'undefined') return false;
  if (native === null) {
    try { native = document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== ''; }
    catch { native = false; }
  }
  return !native;
}

/** Hâm nóng trang chi tiết. */
export function preloadDetail() {
  start(loadDetail);
}

/** Hâm nóng trang xem: chunk của trang, kèm engine phát nếu máy này cần tới nó. */
export function preloadPlayer() {
  start(loadWatch);
  if (needsPlayerEngine()) start(loadPlayerEngine);
}
