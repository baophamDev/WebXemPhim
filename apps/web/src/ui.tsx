/**
 * Mảnh giao diện dùng chung: khung trang, thẻ phim, các trạng thái rỗng/lỗi.
 * Mỗi trang nằm ở src/pages/ và được nạp lười, nên mọi thứ chia sẻ phải ở đây
 * để không bị nhân bản vào từng chunk.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Clapperboard, Compass, Film, Library, LoaderCircle, Menu, Play,
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
  return <Link className="movie-card" to={`/movie/${movie.slug}`} aria-label={`Chi tiết ${movie.name}`}>
    {rank ? <span className="rank">{rank}</span> : null}
    <div className="poster">
      <img
        src={image(movie) || '/poster-placeholder.svg'} alt={movie.name}
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

export function MovieRow({ label, title, items, to, ranked = false }: { label: string; title: string; items: Movie[]; to: string; ranked?: boolean }) {
  if (!items.length) return null;
  return <section className="shelf">
    <div className="section-heading">
      <div><RailLabel prefix="MỤC">{label}</RailLabel><h2>{title}</h2></div>
      <Link to={to}>Xem tất cả<ChevronRight /></Link>
    </div>
    <div className={ranked ? 'movie-row ranked' : 'movie-row'}>
      {items.map((movie, index) => <MovieCard key={`${movie.slug}-${index}`} movie={movie} rank={ranked ? index + 1 : undefined} />)}
    </div>
  </section>;
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
