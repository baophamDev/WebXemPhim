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
 * Class `pin-on` trên scope trang chủ bật lớp layout ghim hero (xem useHeroPin).
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { stillMotion } from './format';
import { registerScroller } from './smooth';

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

/**
 * Lớp nền hero fixed + khung nội dung trượt lên phủ qua (trang chủ pin).
 *
 * Cơ chế: `.home-bg` (header + hero full-bleed) fixed đứng yên; `.home-frame`
 * (khung viền, chỉ từ sheet trở xuống) có `margin-top` đẩy xuống dưới viewport
 * nên lúc đầu lộ nguyên hero, cuộn thì frame phủ lên nền. ScrollTrigger scrub
 * theo vị trí sheet: overlay mờ dần 0→1, cột hero-layout trôi chậm lên trên
 * tạo chiều sâu. Cuộn về đầu thì scrub trả mọi thứ về như cũ.
 *
 * Cửa an toàn: không JS / giảm motion / màn hẹp (CSS về flow thường) / chưa có
 * `enabled` thì không gắn class, trang giữ nguyên bố cục cũ — không kẹt layout.
 */
const PIN_MIN_WIDTH = '(min-width: 821px)';

export function useHeroPin<T extends HTMLElement = HTMLElement>(enabled = true, deps: unknown[] = []) {
  registerMotion();
  const scope = useRef<T>(null);
  useGSAP(() => {
    if (!enabled || !motionAllowed() || !scope.current) return;
    if (typeof window.matchMedia === 'function' && !window.matchMedia(PIN_MIN_WIDTH).matches) return;
    const root = scope.current;
    root.classList.add('pin-on');
    markGsapOn();
    const sheet = root.querySelector('.home-sheet');
    const overlay = root.querySelector('.hero-overlay');
    const layout = root.querySelector('.hero-layout');
    if (!sheet || !overlay) return;
    // scrub bằng số (giây đuổi theo) thay vì `true` để chuyển động trễ nhẹ và
    // mượt theo quán tính cuộn, không còn cảm giác khựng từng nấc.
    gsap.to(overlay, {
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: sheet, start: 'top 92%', end: 'top 40%', scrub: 1.2 }
    });
    if (layout) {
      gsap.to(layout, {
        y: -70,
        ease: 'none',
        scrollTrigger: { trigger: sheet, start: 'top 92%', end: 'top 0%', scrub: 1 }
      });
    }
    // Poster lazy-load làm chiều cao trang đổi sau mount — đo lại mốc trigger.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    return () => window.removeEventListener('load', refresh);
  }, { scope, dependencies: [enabled, ...deps], revertOnUpdate: true });
  return scope;
}

/**
 * Cuộn mượt toàn trang bằng Lenis: bánh xe chạy có quán tính thay vì nhảy
 * từng nấc, nhưng vẫn điều khiển đúng thanh cuộn gốc nên `position: fixed`
 * (nền hero trang chủ) và `content-visibility` giữ nguyên tác dụng.
 *
 * Chỉ chạy khi layout ghim đang bật (class `pin-on` do `useHeroPin` đặt trên
 * cùng phần tử): ngoài nhánh đó trang cuộn tự nhiên. Cửa an toàn giống các
 * hook còn lại — không JS / giảm motion thì không dựng Lenis. Phần tử được
 * dùng làm mốc phải là cùng `.home` với `useHeroPin` (ghép ref qua callback).
 */
export function useSmoothScroll<T extends HTMLElement = HTMLElement>(enabled = true, deps: unknown[] = []) {
  registerMotion();
  const scope = useRef<T>(null);
  useGSAP(() => {
    const root = scope.current;
    if (!enabled || !motionAllowed() || !root) return;
    if (stillMotion()) return;
    if (!root.classList.contains('pin-on')) return;
    // autoRaf false: Lenis chạy trong cùng ticker với GSAP để ScrollTrigger
    // scrub khớp cuộn, không trễ một frame.
    const lenis = new Lenis({ autoRaf: false });
    gsap.ticker.add(lenis.raf);
    gsap.ticker.lagSmoothing(0);
    registerScroller(lenis);
    return () => {
      registerScroller(null);
      gsap.ticker.lagSmoothing(500, 33);
      gsap.ticker.remove(lenis.raf);
      lenis.destroy();
    };
  }, { scope, dependencies: [enabled, ...deps], revertOnUpdate: true });
  return scope;
}
