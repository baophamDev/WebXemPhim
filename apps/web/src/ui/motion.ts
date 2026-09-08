/**
 * Platform animation chung của web, dựng trên GSAP.
 *
 * Vì sao gom vào đây thay vì rải `gsap.from` khắp các trang: mọi chuyển động
 * phải qua cùng một công tắc (`stillMotion()` — prefers-reduced-motion), cùng
 * một cách dọn dẹp (StrictMode mount hai lần), và cùng một fallback — trạng
 * thái đầu của hiệu ứng luôn đặt bằng JS lúc chạy, KHÔNG giấu sẵn trong CSS,
 * nên không có JS / lib lỗi thì nội dung vẫn hiện đủ.
 *
 * Quy ước: CSS chỉ giữ keyframes cho skeleton/loading (shine, sweep, glide...),
 * còn chuyển động vào trang (entrance/reveal) do GSAP nắm. Class `gsap-on` trên
 * <html> để CSS tắt keyframes entrance trùng (hero) khi GSAP đã nhận việc.
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { stillMotion } from './format';

let registered = false;
/** Đăng ký plugin một lần cho cả app — gọi nhiều lần cũng vô hại. */
export function registerMotion() {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  registered = true;
}

/** GSAP có được phép chạy không: đủ DOM + người dùng không yêu cầu giảm motion. */
export const motionAllowed = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined' && !stillMotion();

/** Đánh dấu <html> để CSS tắt các keyframes entrance mà GSAP đã thay thế. */
export function markGsapOn() {
  document.documentElement.classList.add('gsap-on');
}

export { useGSAP };

/**
 * Hiện dần một khối khi nó vào viewport (dải phim, lưới, tiêu đề trang...).
 * Chạy một lần rồi thôi (`once`), biên dưới 12% để khối kịp hiện trước khi
 * người đọc cuộn tới. `deps` để animate lại khi nội dung đổi (đổi trang, đổi
 * filter) — element không remount trong các trường hợp đó.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(offsetY = 26, deps: unknown[] = []) {
  registerMotion();
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed()) return;
    markGsapOn();
    const ctx = gsap.context(() => {
      gsap.from(el, {
        y: offsetY,
        opacity: 0,
        duration: 0.55,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetY, ...deps]);
  return ref;
}

/**
 * Mở màn hero (trang chủ + trang chi tiết): ảnh nền hiện dần, chữ trong cột
 * trái trồi lên so le, panel trồi sau cùng — đúng nhịp chuỗi `rise`/`fade` cũ
 * của CSS nhưng do GSAP nắm để dễ chỉnh nhịp về sau.
 *
 * Đánh dấu bằng data-attribute để không phụ thuộc class: ảnh
 * `data-motion="media"`, cột chữ `data-motion="copy"`, panel hero là `.hero-beam`.
 * `deps` (thường là slug phim) để đổi phim thì diễn lại từ đầu.
 */
export function useHeroEntrance<T extends HTMLElement = HTMLElement>(deps: unknown[] = []) {
  registerMotion();
  const scope = useRef<T>(null);
  useGSAP(() => {
    if (!motionAllowed() || !scope.current) return;
    markGsapOn();
    const q = gsap.utils.selector(scope);
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from(q('[data-motion="media"]'), { opacity: 0, duration: 0.6 }, 0)
      .from(q('[data-motion="copy"] > *'), { y: 26, opacity: 0, duration: 0.5, stagger: 0.07 }, 0.05);
    if (q('.hero-beam').length) {
      tl.from(q('.hero-beam'), { y: 26, opacity: 0, duration: 0.5 }, 0.16);
    }
  }, { scope, dependencies: deps, revertOnUpdate: true });
  return scope;
}
