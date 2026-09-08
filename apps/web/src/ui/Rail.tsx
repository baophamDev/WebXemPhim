/**
 * Dải phim cuốn ngang: kéo bằng chuột, bước bằng nút hoặc phím mũi tên, tự cuốn
 * khi đang trong tầm mắt. Toàn bộ phần tính toán nằm trong `useRail`, phần dựng
 * hình chỉ đọc kết quả.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKey, type MouseEvent as ReactMouse, type PointerEvent as Pointer } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Movie } from '../types';
import { stillMotion } from './format';
import { useReveal } from './motion';
import { MovieCard, RailLabel } from './cards';

const AUTO_MS = 4000;

type RailProps = { label: string; title: string; items: Movie[]; to: string; ranked?: boolean };

/**
 * Cơ chế của dải phim cuốn ngang. Bước nhảy đo từ thẻ đầu tiên nên tự đúng cho
 * cả dải xếp hạng (thẻ rộng hơn) và mọi ngưỡng responsive — không hardcode.
 */
function useRail(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [span, setSpan] = useState(1);
  const [cycle, setCycle] = useState(0);
  const [hold, setHold] = useState(false);
  const [awake, setAwake] = useState(false);
  const [hover, setHover] = useState(false);
  const drag = useRef({ id: -1, from: 0, left: 0, moved: false });

  /** step: bề rộng một bước (thẻ + khe). inset: đệm hai bên của vùng cuộn. */
  const metrics = () => {
    const el = ref.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card?.offsetWidth) return null;
    const box = getComputedStyle(el);
    return {
      step: card.offsetWidth + parseFloat(box.columnGap || '0'),
      inset: parseFloat(box.paddingInlineStart || '0') + parseFloat(box.paddingInlineEnd || '0')
    };
  };

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    const size = metrics();
    if (!el || !size) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max < 4) return; // dải ngắn hơn màn hình: không có gì để cuốn
    // Hết dải thì vòng lại đầu. Cú vòng nhảy thẳng chứ không cuộn mượt: trôi qua
    // cả hai chục thẻ mất vài giây và nhìn như dải bị mất điều khiển.
    const wrap = (dir > 0 && el.scrollLeft >= max - 4) || (dir < 0 && el.scrollLeft <= 4);
    const to = wrap ? (dir > 0 ? 0 : max) : el.scrollLeft + dir * size.step;
    el.scrollTo({ left: to, behavior: wrap || stillMotion() ? 'auto' : 'smooth' });
  };
  const nudge = (dir: 1 | -1) => { go(dir); setCycle((c) => c + 1); };

  // Vị trí đọc ngược từ scrollLeft, nên kéo tay hay bấm nút đều ra cùng một số.
  // ResizeObserver thay cho window resize: nó bắt cả lúc dải rộng 0 (bị
  // content-visibility bỏ qua vì còn ngoài màn hình) chuyển thành có bố cục thật.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const size = metrics();
      if (!size) return;
      setIndex(Math.min(count - 1, Math.round(el.scrollLeft / size.step)));
      setSpan(Math.max(1, Math.round((el.clientWidth - size.inset) / size.step)));
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(read); };
    el.addEventListener('scroll', queue, { passive: true });
    const watch = new ResizeObserver(queue);
    watch.observe(el);
    read();
    return () => { el.removeEventListener('scroll', queue); watch.disconnect(); cancelAnimationFrame(frame); };
  }, [count]);

  // Trang chủ có 5 dải, chỉ một dải nằm trong tầm mắt: bốn dải kia không có lý
  // do gì phải cuộn ngầm mỗi 4 giây.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setAwake(true); return; }
    const watch = new IntersectionObserver(([entry]) => setAwake(entry.isIntersecting), { threshold: 0.3 });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // span có trong deps để dải vừa đủ rộng trên máy tính, sau khi thu nhỏ cửa sổ
  // thành tràn, sẽ tự bắt đầu cuốn.
  useEffect(() => {
    const el = ref.current;
    if (!el || hover || hold || !awake || count < 2 || stillMotion()) return;
    if (el.scrollWidth - el.clientWidth < 4) return;
    const timer = window.setTimeout(() => { go(1); setCycle((c) => c + 1); }, AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [hover, hold, awake, cycle, count, span]);

  const release = (event: Pointer<HTMLDivElement>) => {
    const grip = drag.current;
    if (grip.id !== event.pointerId) return;
    grip.id = -1;
    ref.current?.releasePointerCapture(event.pointerId);
    setHold(false); // bỏ .dragging → scroll-snap bật lại và tự dính vào thẻ gần nhất
    if (!grip.moved) return;
    setCycle((c) => c + 1);
    // Cờ "đã kéo" chỉ cần sống đủ lâu để chặn cú click ngay sau đó. Trình duyệt
    // gửi click trước khi tới lượt hàng đợi hẹn giờ, nên xoá ở đây là an toàn —
    // và tránh cờ cũ ăn mất một lần bấm Enter về sau.
    setTimeout(() => { drag.current.moved = false; }, 0);
  };

  const handlers = {
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
    onPointerDown: (event: Pointer<HTMLDivElement>) => {
      // Cảm ứng bỏ qua: trình duyệt đã cuộn có quán tính, tự tính lại chỉ kém hơn.
      const el = ref.current;
      if (!el || event.pointerType === 'touch' || event.button !== 0) return;
      drag.current = { id: event.pointerId, from: event.clientX, left: el.scrollLeft, moved: false };
      el.setPointerCapture(event.pointerId);
      setHold(true);
    },
    onPointerMove: (event: Pointer<HTMLDivElement>) => {
      const el = ref.current;
      const grip = drag.current;
      if (!el || grip.id !== event.pointerId) return;
      const shift = event.clientX - grip.from;
      if (Math.abs(shift) > 5) grip.moved = true;
      el.scrollLeft = grip.left - shift;
    },
    onPointerUp: release,
    // Mất con trỏ giữa cú kéo (chuột bị nhấc, cử chỉ hệ thống chen vào) mà không
    // dọn thì .dragging dính mãi: dải hết tự cuốn và con trỏ kẹt ở hình bàn tay.
    onPointerCancel: release,
    // Thả tay sau khi kéo sẽ sinh một cú click trên thẻ đang ở dưới con trỏ:
    // chặn ở pha capture, nếu không mỗi lần kéo là một lần bị điều hướng.
    onClickCapture: (event: ReactMouse<HTMLDivElement>) => {
      if (!drag.current.moved) return;
      event.preventDefault();
      event.stopPropagation();
    },
    onKeyDown: (event: ReactKey<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      nudge(event.key === 'ArrowRight' ? 1 : -1);
    }
  };
  return { ref, index, span, hold, nudge, handlers };
}

/**
 * Một mục phim: tiêu đề bên trái, khối điều khiển vát góc bên phải (vạch chia
 * vị trí + số thứ tự + hai nút bước), dải thẻ cuốn ngang bên dưới.
 */
function Rail({ label, title, items, to, ranked = false }: RailProps) {
  const { ref, index, span, hold, nudge, handlers } = useRail(items.length);
  const shelf = useReveal<HTMLElement>(26, [items.length]);
  return <section className="shelf" ref={shelf}>
    <div className="section-heading">
      <div><RailLabel prefix="MỤC">{label}</RailLabel><h2>{title}</h2></div>
      <div className="rail-tools">
        <Link className="rail-all" to={to}>Xem tất cả<ChevronRight /></Link>
        <div className="rail-transport">
          {/* Vạch sáng là cửa sổ đang thấy, không phải một điểm: nhìn ra ngay
              đang ở đâu và còn bao nhiêu phim phía sau. */}
          <span className="rail-ticks" aria-hidden="true">
            {items.map((movie, i) => <i key={`${movie.slug}-${i}`} className={i >= index && i < index + span ? 'on' : ''} />)}
          </span>
          <span className="rail-count" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}<i>/</i>{String(items.length).padStart(2, '0')}
          </span>
          <button type="button" onClick={() => nudge(-1)} aria-label={`Phim trước trong mục ${title}`}><ChevronLeft /></button>
          <button type="button" onClick={() => nudge(1)} aria-label={`Phim sau trong mục ${title}`}><ChevronRight /></button>
        </div>
      </div>
    </div>
    <div className="rail">
      <div
        {...handlers} ref={ref} tabIndex={0} role="group"
        className={`movie-row${ranked ? ' ranked' : ''}${hold ? ' dragging' : ''}`}
        aria-label={`${title}: ${items.length} phim. Giữ chuột kéo ngang, hoặc dùng phím mũi tên trái phải.`}
      >
        {items.map((movie, i) => <MovieCard key={`${movie.slug}-${i}`} movie={movie} rank={ranked ? i + 1 : undefined} />)}
      </div>
    </div>
  </section>;
}

export function MovieRow(props: RailProps) {
  // Bọc ngoài để cái chốt "không có phim thì không dựng gì" không nằm trước hook.
  if (!props.items.length) return null;
  return <Rail {...props} />;
}
