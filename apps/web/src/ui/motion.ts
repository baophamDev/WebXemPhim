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
 * Thanh trên trôi nổi (trang chủ): một thanh fixed riêng, hai trạng thái.
 *
 * - Đứng đầu (scroll 0): tràn đầy hai mép, nền là gradient tắt dần hợp nhất
 *   với ảnh hero — đúng dáng ban đầu của trang.
 * - Trôi nổi (đã cuộn): thu nhỏ còn viên thuốc bo góc viền aurora, nằm giữa
 *   màn hình trên nội dung, bóng đổ xuống như một thiết bị thật.
 *
 * Hành vi theo yêu cầu "trượt đi mượt mà": mỗi lần đổi trạng thái, thanh bay
 * LÊN hết khỏi màn hình rồi rơi ngược xuống đúng vị trí nghỉ của trạng thái
 * mới — cuộn xuống là vọt lên rồi thả vào viên thuốc, cuộn ngược lên tận đầu
 * thì vọt lên rồi sà xuống trả về dáng cũ. Chuyển động là một timeline GSAP
 * hai nhịp (bay lên .2s + rơi xuống .34s) trên transform; nền/viền/bo góc đổi
 * qua class `.is-float` có transition CSS chạy cùng nhịp nên đọc là một khối
 * đang chuyển dạng. play()/reverse() đảo chiều từ đúng thời điểm hiện tại nên
 * đổi ý giữa chừng không giật.
 *
 * Cửa an toàn giống các hook còn lại: không JS / giảm motion / màn hẹp / thanh
 * chưa vào layout pin thì không gắn gì — header nằm `absolute` trên hero theo
 * CSS mặc định, không kẹt.
 */
const FLOAT_MIN_WIDTH = '(min-width: 821px)';

export function useFloatingHeader<T extends HTMLElement = HTMLElement>(deps: unknown[] = []) {
  registerMotion();
  const scope = useRef<T>(null);
  useGSAP(() => {
    const bar = scope.current;
    if (!bar || !motionAllowed()) return;
    if (typeof window.matchMedia === 'function' && !window.matchMedia(FLOAT_MIN_WIDTH).matches) return;
    // Chỉ chạy khi layout pin đã dựng: CSS mobile tắt pin thì thanh nằm absolute
    // trên hero theo flow thường — float sẽ đè nội dung. useHeroPin đăng ký
    // trước hook này trên cùng phần tử nên class đã có tại đây.
    const root = bar.closest('.home');
    if (!root?.classList.contains('pin-on')) return;
    const skin = bar.querySelector<HTMLElement>('.app-header');
    if (!skin) return;
    bar.classList.add('float-on');
    markGsapOn();
    // Bar cao 0 (con tuyệt đối không kéo giãn cha) nên đo phần tử da bên trong;
    // trừ thêm chút nữa cho chắc chắn khuất hẳn khỏi mép trên.
    const hideY = -skin.offsetHeight - 16;
    // Thu nhỏ quanh mép TRÊN và rơi xuống chừa 12px trần — thanh full-bleed
    // thu dần thành viên thuốc treo giữa màn hình, không nhảy inset.
    gsap.set(bar, { transformOrigin: '50% 0%' });
    const tl = gsap.timeline({ paused: true })
      .to(bar, { y: hideY, duration: 0.2, ease: 'power2.in' })
      .to(bar, { y: 12, scale: 0.875, duration: 0.34, ease: 'power3.out' }); // Dáng nổi thu còn 0.875 ≈ --header-h: nhỏ hơn thì các nút 46px chật thuốc.
    let floating = false;
    const setState = (next: boolean) => {
      if (next === floating) return;
      floating = next;
      bar.classList.toggle('is-float', floating);
      if (floating) tl.play(); else tl.reverse();
    };
    // Reload/quay lại đang giữa trang: vào thẳng dáng nổi, khỏi diễn mở màn.
    if (window.scrollY > 4) {
      floating = true;
      bar.classList.add('is-float');
      tl.progress(1);
    }
    // Thanh fixed luôn trong viewport nên mốc chỉ cần "đã rời đầu trang" —
    // nghe scroll trực tiếp thay vì ScrollTrigger: .home-frame có margin-top
    // 100vh và margin-collapse đẩy chính .home xuống 900px trong document,
    // nên mọi trigger theo toạ độ .home đều lệch đúng một màn hình.
    let last = window.scrollY;
    let active = true; // breakpoint mobile tạm ngưng, quay lại desktop thì bật lại
    const onScroll = () => {
      if (!active) return;
      const y = window.scrollY;
      const down = y > last;
      last = y;
      if (down && y > 4) setState(true); // xuống là vọt lên ngay
      else if (!down && y <= 4) setState(false); // lên hết mới sà xuống
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Cửa sổ resize qua ngưỡng desktop ↔ mobile: CSS mobile trả thanh về
    // absolute trên hero theo flow thường — ngừng can thiệp và dọn sạch state,
    // không thì is-float sống sót và viên thuốc đè lên hero mobile
    // (đúng lỗi test resize bắt được).
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(FLOAT_MIN_WIDTH) : null;
    const onBreakpoint = (event: MediaQueryListEvent) => {
      active = event.matches;
      if (event.matches) {
        bar.classList.add('float-on');
        // Vào lại desktop đang giữa trang: thả thẳng về dáng nổi.
        if (window.scrollY > 4) setState(true);
      } else {
        setState(false);
        bar.classList.remove('float-on');
        gsap.set(bar, { clearProps: 'transform' });
      }
    };
    mq?.addEventListener('change', onBreakpoint);
    return () => {
      window.removeEventListener('scroll', onScroll);
      mq?.removeEventListener('change', onBreakpoint);
      tl.kill();
      bar.classList.remove('is-float');
    };
  }, { scope, dependencies: deps, revertOnUpdate: true });
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
