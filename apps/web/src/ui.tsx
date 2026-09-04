/**
 * Mảnh giao diện dùng chung: khung trang, thẻ phim, các trạng thái rỗng/lỗi.
 * Mỗi trang nằm ở src/pages/ và được nạp lười, nên mọi thứ chia sẻ phải ở đây
 * để không bị nhân bản vào từng chunk.
 */
import {
  useEffect, useRef, useState,
  type FormEvent, type KeyboardEvent as ReactKey, type MouseEvent as ReactMouse,
  type PointerEvent as Pointer, type ReactNode
} from 'react';
import { Link, NavLink, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ArrowUp, ChevronLeft, ChevronRight, Clapperboard, Compass, Film, Library, LoaderCircle, Menu, Play,
  RefreshCw, Search, Star, Users, WifiOff, X
} from 'lucide-react';
import { apiOfflineHint, useGetHealthQuery, useGetSyncQuery, useStartSyncMutation } from './api';
import type { Movie } from './types';

export const listLabels: Record<string, string> = {
  'phim-moi-cap-nhat': 'Mới cập nhật', 'phim-le': 'Phim lẻ', 'phim-bo': 'Phim bộ', 'dang-chieu': 'Đang chiếu',
  '4k': 'Phim 4K', 'long-tieng': 'Lồng tiếng', 'thuyet-minh': 'Thuyết minh', subteam: 'Subteam'
};
export const image = (movie: Movie, wide = false) => (wide ? movie.thumbUrl || movie.posterUrl : movie.posterUrl || movie.thumbUrl);
export const clean = (html: string | null) => (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
export const humanize = (value: string) => decodeURIComponent(value).replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

/** Chờ người dùng ngừng gõ trước khi gọi API — tránh một request mỗi ký tự. */
export function useDebounced<T>(value: T, delay = 320) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

const scrollPositions = new Map<string, number>();
function NavigationEffects() {
  const location = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    const y = type === 'POP' ? scrollPositions.get(location.key) ?? 0 : 0;
    requestAnimationFrame(() => scrollTo({ top: y }));
    return () => { scrollPositions.set(location.key, scrollY); };
  }, [location.key]);
  return null;
}

export function Logo() {
  return <Link className="logo" to="/" aria-label="BảoNhànCinema — trang chủ"><span><Clapperboard /></span><b>BảoNhànCinema</b></Link>;
}

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.body.classList.add('menu-open');
    addEventListener('keydown', close);
    return () => { document.body.classList.remove('menu-open'); removeEventListener('keydown', close); };
  }, [menuOpen]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = q.trim();
    if (value) navigate(`/search?q=${encodeURIComponent(value)}`);
  };
  return <header className="app-header">
    <Logo />
    <button className={menuOpen ? 'nav-backdrop open' : 'nav-backdrop'} onClick={() => setMenuOpen(false)} aria-label="Đóng menu" />
    <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Điều hướng chính">
      <NavLink to="/" end><Film />Trang chủ</NavLink>
      <NavLink to="/browse/list/phim-le"><Film />Phim lẻ</NavLink>
      <NavLink to="/browse/list/phim-bo"><Clapperboard />Phim bộ</NavLink>
      <NavLink to="/browse/list/dang-chieu"><Compass />Khám phá</NavLink>
      <NavLink to="/people"><Users />Diễn viên</NavLink>
      <NavLink to="/library"><Library />Thư viện</NavLink>
      <button className="nav-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X /></button>
    </nav>
    <div className="header-actions">
      <form className="header-search" onSubmit={submit} role="search">
        <Search />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên phim hoặc diễn viên" aria-label="Tìm phim hoặc diễn viên" />
      </form>
      <Link className="icon-button mobile-search" to="/search" aria-label="Tìm kiếm"><Search /></Link>
      <Link className="icon-button desktop-icon" to="/library" aria-label="Thư viện của tôi"><Library /></Link>
      <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Mở menu" aria-expanded={menuOpen}><Menu /></button>
    </div>
  </header>;
}

export function Shell({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return <div className={flush ? 'app-frame flush' : 'app-frame'}>
    <NavigationEffects />
    <Header />
    <main className={flush ? 'flush' : ''}>{children}</main>
    <footer>
      <Logo />
      <p>© {new Date().getFullYear()} BảoNhànCinema · Rạp phim riêng của gia đình</p>
      <div><Link to="/local">Kho đã lưu</Link><Link to="/people">Diễn viên</Link><Link to="/showtimes">Lịch phát hành</Link></div>
    </footer>
  </div>;
}

/** Nhãn mục dạng "MỤC // TÊN" — nhất quán cho mọi tiêu đề trên trang. */
export function RailLabel({ prefix, children }: { prefix: string; children: ReactNode }) {
  return <span className="rail-label">{prefix} // <b>{children}</b></span>;
}

export function Spec({ movie }: { movie: Movie }) {
  return <ul className="spec">
    {movie.rating ? <li className="rating"><Star fill="currentColor" />{movie.rating.toFixed(1)}</li> : null}
    {movie.year ? <li>{movie.year}</li> : null}
    <li>{movie.type === 'series' || movie.type === 'tv' ? 'Phim bộ' : 'Phim lẻ'}</li>
    {movie.duration ? <li>{movie.duration}</li> : null}
    {movie.quality ? <li><span className="tag">{movie.quality}</span></li> : null}
  </ul>;
}

export function MovieCard({ movie, rank }: { movie: Movie; rank?: number }) {
  // draggable=false: thẻ nằm trong dải kéo ngang được, mà mặc định trình duyệt
  // cho kéo cả link và ảnh — ảnh mờ bay theo con trỏ làm cú kéo trông như lỗi.
  return <Link className="movie-card" to={`/movie/${movie.slug}`} draggable={false} aria-label={`Chi tiết ${movie.name}`}>
    {rank ? <span className="rank">{rank}</span> : null}
    <div className="poster">
      <img
        src={image(movie) || '/poster-placeholder.svg'} alt={movie.name} draggable={false}
        loading="lazy" decoding="async" sizes="(max-width: 820px) 45vw, 15vw"
      />
      <span className="card-play"><Play fill="currentColor" /></span>
      <div className="badges">
        {movie.quality ? <b>{movie.quality}</b> : null}
        {movie.language ? <b>{movie.language.split('+')[0].trim()}</b> : null}
      </div>
    </div>
    <h3>{movie.name}</h3>
    <p className="spec-line">
      <span>{movie.year || 'Chưa rõ năm'}</span>
      {movie.rating ? <><Star fill="currentColor" />{movie.rating.toFixed(1)}</> : null}
    </p>
  </Link>;
}

const AUTO_MS = 4000;
const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  return <section className="shelf">
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

/** Nút về đầu trang. Chỉ dựng sau khi đã cuộn quá một màn hình, để không che poster. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => { frame = 0; setShow(scrollY > 600); };
    const queue = () => { if (!frame) frame = requestAnimationFrame(read); };
    addEventListener('scroll', queue, { passive: true });
    read();
    return () => { removeEventListener('scroll', queue); cancelAnimationFrame(frame); };
  }, []);
  if (!show) return null;
  return <button className="to-top" type="button" onClick={() => scrollTo({ top: 0, behavior: stillMotion() ? 'auto' : 'smooth' })}>
    <ArrowUp /><span>Đầu trang</span>
  </button>;
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return <div className="movie-grid">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}><i /><b /><span /></div>)}</div>;
}
export function RouteFallback() {
  return <div className="route-fallback"><LoaderCircle className="spin" /></div>;
}
export function ErrorState({ onRetry, message = 'Không tải được dữ liệu.' }: { onRetry?: () => void; message?: string }) {
  return <div className="state-panel">
    <WifiOff /><h2>Mất kết nối</h2><p>{message}</p>
    {onRetry ? <button className="button ghost" onClick={onRetry}><RefreshCw />Thử lại</button> : null}
  </div>;
}
export function EmptyState({ title = 'Chưa có nội dung', message = 'Đổi bộ lọc hoặc quay lại sau.' }: { title?: string; message?: string }) {
  return <div className="state-panel"><Film /><h2>{title}</h2><p>{message}</p></div>;
}

export function Breadcrumb({ items }: { items: [string, string][] }) {
  return <nav className="breadcrumb" aria-label="Đường dẫn">
    {items.map(([label, to], index) => <span key={`${label}-${index}`}>{index > 0 ? <ChevronRight /> : null}{to ? <Link to={to}>{label}</Link> : <b>{label}</b>}</span>)}
  </nav>;
}

export function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (page: number) => void }) {
  if (total <= 1) return null;
  const pages = Array.from(new Set([1, current - 1, current, current + 1, total])).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return <nav className="pagination" aria-label="Phân trang">
    <button disabled={current <= 1} onClick={() => onChange(current - 1)} aria-label="Trang trước"><ChevronLeft /></button>
    {pages.map((page, index) => <span key={page}>
      {index > 0 && page - pages[index - 1] > 1 ? <i>…</i> : null}
      <button className={page === current ? 'active' : ''} onClick={() => onChange(page)} aria-current={page === current}>{page}</button>
    </span>)}
    <button disabled={current >= total} onClick={() => onChange(current + 1)} aria-label="Trang sau"><ChevronRight /></button>
  </nav>;
}

/**
 * Trạng thái đồng bộ. Chỉ hỏi lại server khi thật sự có việc đang chạy:
 * trước đây poll 3 giây/lần suốt phiên làm việc, tốn pin và giữ tab luôn "bận".
 */
export function SyncStatus() {
  const health = useGetHealthQuery(undefined, { pollingInterval: 60000 });
  const [live, setLive] = useState(false);
  const { data } = useGetSyncQuery(undefined, { pollingInterval: live ? 3000 : 0, skip: health.isError });
  const working = data?.status === 'running';
  useEffect(() => setLive(working), [working]);
  const [start, { isLoading }] = useStartSyncMutation();
  const offline = health.isError;
  const run = async () => { await start({ pages: 3 }); setLive(true); };
  return <div className={offline ? 'sync-status offline' : 'sync-status'}>
    <span className="sync-icon">{offline ? <WifiOff /> : <RefreshCw className={working ? 'spin' : ''} />}</span>
    <div>
      <b>{offline ? 'API ngoại tuyến' : working ? 'Đang cập nhật kho phim' : 'Kho phim đã lưu'}</b>
      <small>{offline ? apiOfflineHint() : working ? `${data?.processed ?? 0} phim · trang ${data?.page ?? 0}/${data?.totalPages ?? '?'}` : `${data?.processed ?? 0} phim đã đồng bộ`}</small>
    </div>
    <button disabled={offline || working || isLoading} onClick={run}>{working ? 'Đang chạy' : 'Đồng bộ'}</button>
  </div>;
}
