/**
 * Khung trang: header có menu + ô tìm kiếm, footer, và phần khôi phục vị trí cuộn
 * khi bấm nút Back. Mọi trang đều bọc trong `Shell`.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Clapperboard, Compass, Film, Library, Menu, Search, Users, X } from 'lucide-react';
// Import thẳng từ './pickers', không qua barrel './index': Shell nằm trong barrel đó
// nên đi đường vòng là tạo phụ thuộc quay đầu giữa hai module.
import { ThemePicker } from './pickers';

const scrollPositions = new Map<string, number>();

/**
 * Điều hướng mới thì về đầu trang; bấm Back thì trả lại đúng chỗ đang đọc. Lưu
 * theo `location.key` nên hai lần vào cùng một URL vẫn là hai vị trí riêng.
 */
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
      <ThemePicker />
      <Link className="icon-button desktop-icon" to="/library" aria-label="Thư viện của tôi"><Library /></Link>
      <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Mở menu" aria-expanded={menuOpen}><Menu /></button>
    </div>
  </header>;
}

export function Shell({ children, flush = false, backdrop }: { children: ReactNode; flush?: boolean; backdrop?: ReactNode }) {
  return <div className={flush ? 'app-frame flush' : 'app-frame'}>
    <NavigationEffects />
    <Header />
    {backdrop}
    <main className={flush ? 'flush' : ''}>{children}</main>
    <footer>
      <Logo />
      <p>© {new Date().getFullYear()} BảoNhànCinema · Rạp phim riêng của gia đình</p>
      <div><Link to="/local">Kho đã lưu</Link><Link to="/people">Diễn viên</Link><Link to="/showtimes">Lịch phát hành</Link></div>
    </footer>
  </div>;
}
