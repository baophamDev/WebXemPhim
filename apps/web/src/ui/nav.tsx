/** Mảnh điều hướng trong trang: đường dẫn, phân trang, nút về đầu trang. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { stillMotion } from './format';
import { smoothScrollTo } from './smooth';

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
  return <button className="to-top" type="button" onClick={() => smoothScrollTo(0, { immediate: stillMotion() })}>
    <ArrowUp /><span>Đầu trang</span>
  </button>;
}
