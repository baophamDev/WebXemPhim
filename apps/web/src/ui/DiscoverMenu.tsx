/**
 * Menu "Khám phá" trên thanh điều hướng: rê chuột vào là mở, cột trái là năm nhóm
 * lọc, cột phải là giá trị của nhóm đang trỏ tới. Mọi giá trị là link thật (dựng
 * bởi `browseHref`) nên mở tab mới hay sao chép link đều dùng được.
 *
 * Vì sao panel không nằm gọn trong khối của mục menu: `.main-nav` là khung cuộn
 * ngang — một khối định vị *bên trong* khung cuộn sẽ bị cắt cụt. Panel được đặt
 * tuyệt đối so với `header` (tổ tiên có `position` gần nhất nằm ngoài khung cuộn),
 * nên mỗi lần mở phải đo `offsetLeft` của mục menu để panel nằm ngay bên dưới nó.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight, Compass } from 'lucide-react';
import { useGetNavigationQuery } from '../api';
import { browseHref, STATUS_OPTIONS, TYPE_OPTIONS, type DiscoverGroup } from '../filters';
import type { TaxonomyItem } from '../types';

const GROUPS: { key: DiscoverGroup; label: string }[] = [
  { key: 'genre', label: 'Thể loại' },
  { key: 'country', label: 'Quốc gia' },
  { key: 'year', label: 'Năm' },
  { key: 'format', label: 'Định dạng' },
  { key: 'status', label: 'Trạng thái' }
];

/** Menu chỉ liệt kê vài năm gần nhất; danh sách đầy đủ nằm ở ô chọn trang Khám phá. */
const YEAR_LIMIT = 12;

export function DiscoverMenu() {
  const nav = useGetNavigationQuery();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<DiscoverGroup>('genre');
  const [left, setLeft] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    addEventListener('keydown', close);
    return () => removeEventListener('keydown', close);
  }, [open]);

  // Đo lúc panel đã dựng (trước khi vẽ) và đo lại khi cửa sổ đổi bề rộng — thanh
  // menu co giãn theo bề rộng nên toạ độ đo lúc mở có thể đã cũ.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = box.current;
      if (!anchor) return;
      const room = panel.current ? innerWidth - panel.current.offsetWidth : innerWidth;
      setLeft(Math.max(12, Math.min(anchor.offsetLeft, room - 12)));
    };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [open]);

  // Năm trên URL của nguồn có thể xếp lộn xộn; menu thì luôn muốn mới nhất trước.
  const years = [...(nav.data?.years ?? [])]
    .sort((a, b) => (Number(b.slug) || 0) - (Number(a.slug) || 0))
    .slice(0, YEAR_LIMIT);
  const values: Record<DiscoverGroup, TaxonomyItem[]> = {
    genre: nav.data?.genres ?? [],
    country: nav.data?.countries ?? [],
    year: years,
    format: TYPE_OPTIONS,
    status: STATUS_OPTIONS
  };
  const items = values[group];
  const label = GROUPS.find((item) => item.key === group)?.label ?? '';

  return <div
    className="nav-drop" ref={box}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setOpen(true); }}
    onPointerLeave={(event) => { if (event.pointerType === 'mouse') setOpen(false); }}
    onFocus={() => setOpen(true)}
    onBlur={(event) => { if (!box.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}
  >
    <NavLink to="/browse/list/phim-chieu-rap" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(false)}>
      <Compass />Khám phá<ChevronDown className="nav-caret" />
    </NavLink>
    {open ? <div className="nav-drop-panel" ref={panel} style={{ left }}>
      <div className="nav-drop-col" aria-label="Nhóm lọc">
        {GROUPS.map((item) => <button
          key={item.key} type="button" className={item.key === group ? 'on' : ''}
          aria-current={item.key === group}
          onPointerEnter={() => setGroup(item.key)} onFocus={() => setGroup(item.key)} onClick={() => setGroup(item.key)}
        >{item.label}<ChevronRight /></button>)}
      </div>
      <div className="nav-drop-values" aria-label={label}>
        <span className="nav-drop-title">{label}</span>
        {items.length
          ? items.map((item) => <Link key={`${item.id}-${item.slug}`} to={browseHref(group, item)} onClick={() => setOpen(false)}>{item.name}</Link>)
          : <p className="nav-drop-state">{nav.isFetching ? 'Đang tải…' : 'Chưa có dữ liệu'}</p>}
      </div>
    </div> : null}
  </div>;
}
