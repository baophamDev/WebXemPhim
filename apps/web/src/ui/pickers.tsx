/**
 * Hai nút nhỏ trong header: chọn nguồn phim, chọn chế độ sáng/tối.
 *
 * Cùng một file vì chúng dùng chung cách mở/đóng và chung khối CSS `.picker` —
 * tách ra hai file thì phải nhân bản cả hai thứ đó.
 *
 * Chọn nguồn ở đây là **ưu tiên**, không phải khoá cứng: tên được gửi kèm mỗi
 * request catalog, API hỏi nguồn đó trước rồi vẫn lùi sang nguồn khác nếu nó không
 * trả lời. Nguồn `metadata` (TMDB, TVDB) không có link phát, nên khoá cứng vào một
 * nguồn như vậy là tự tay tắt nút play — xem `src/source.ts`.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useDispatch } from 'react-redux';
import { Check, ChevronDown, Layers, Monitor, Moon, Sun } from 'lucide-react';
import { cinemaApi, useGetProvidersQuery } from '../api';
import { AUTO, currentSource, lastAnswer, setSource, subscribeSource } from '../source';
import { activeTheme, setTheme, subscribeTheme, themeChoice, type Theme } from '../theme';

/**
 * Đóng khi bấm ra ngoài hoặc bấm Escape. Dùng `pointerdown` chứ không phải `click`:
 * cú bấm ra ngoài có thể rơi vào một link và đổi trang ngay, lúc đó `click` trên
 * document không kịp chạy và menu dính lại ở trang mới.
 */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', away);
    addEventListener('keydown', key);
    return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', key); };
  }, [open]);
  return { open, setOpen, box };
}

const KIND_LABEL = { playable: 'phát được', metadata: 'chỉ thông tin' } as const;

/**
 * Nút đổi nguồn phim.
 *
 * Đổi nguồn phải xoá sạch cache của RTK Query. Khoá cache được tính từ tham số của
 * endpoint **trước khi** baseQuery gắn `?source=` vào, nên nếu không xoá thì đổi
 * nguồn xong vẫn thấy đúng dữ liệu nguồn cũ và tưởng nút này không chạy.
 *
 * Nút cũng nói ra nguồn **đã trả lời** (`lastAnswer`), không chỉ nguồn được chọn:
 * ưu tiên không phải bảo đảm — chọn tvdb rồi mở trang chủ thì vsmov trả lời vì tvdb
 * không có mục "phim mới cập nhật". Không nói ra thì người dùng tin là mình đang xem
 * dữ liệu tvdb. Một chỗ trong header là đủ cho mọi trang, khỏi luồn props đi khắp nơi.
 */
export function SourcePicker() {
  const dispatch = useDispatch();
  const { open, setOpen, box } = useDropdown();
  const chosen = useSyncExternalStore(subscribeSource, currentSource, () => AUTO);
  const answering = useSyncExternalStore(subscribeSource, lastAnswer, () => null);
  const providers = useGetProvidersQuery();
  const sources = providers.data?.sources ?? [];
  const inactive = providers.data?.inactive ?? [];
  const current = sources.find((source) => source.name === chosen);
  /** Chọn một nguồn nhưng nguồn khác đang trả lời — chuyện thường, nhưng phải nói ra. */
  const drifted = !!answering && chosen !== AUTO && answering !== chosen;
  const choose = (name: string) => {
    setOpen(false);
    const before = currentSource();
    // Chọn lại đúng nguồn đang dùng thì không xoá cache — đang mở trang chi tiết mà
    // xoá là tải lại toàn bộ trang cho một cú bấm không đổi gì.
    if (setSource(name) === before) return;
    dispatch(cinemaApi.util.resetApiState());
  };

  return <div className="picker" ref={box}>
    <button
      type="button" className="icon-button picker-button" onClick={() => setOpen(!open)}
      aria-expanded={open} aria-haspopup="menu"
      title={`${chosen === AUTO ? 'Nguồn phim: tự động' : `Nguồn phim: ${chosen}`}${answering ? ` · đang trả lời: ${answering}` : ''}`}
    >
      <Layers />
      {/* Ở chế độ tự động thì chữ "Tự động" chẳng cho biết gì — hiện luôn nguồn đã trả lời. */}
      <span className="picker-value">{chosen === AUTO ? answering ?? 'Tự động' : chosen}</span>
      {current && !current.healthy ? <i className="dot warn" /> : drifted ? <i className="dot alt" /> : null}
      <ChevronDown className="picker-caret" />
    </button>
    {open ? <div className="picker-menu" role="menu">
      <p className="picker-hint">
        Nguồn được hỏi trước. Không trả lời thì web tự lùi sang nguồn khác.
        {answering ? <> Đang trả lời: <b>{answering}</b>.</> : null}
      </p>
      <button type="button" role="menuitemradio" aria-checked={chosen === AUTO} className={chosen === AUTO ? 'on' : ''} onClick={() => choose(AUTO)}>
        <span className="dot ok" /><b>Tự động</b><small>theo thứ tự của API</small>
        {chosen === AUTO ? <Check className="picker-tick" /> : null}
      </button>
      {sources.map((source) => <button
        key={source.name} type="button" role="menuitemradio" aria-checked={chosen === source.name}
        className={chosen === source.name ? 'on' : ''} onClick={() => choose(source.name)}
        title={source.lastError ? `Lỗi gần nhất: ${source.lastError}` : undefined}
      >
        <span className={source.healthy ? 'dot ok' : 'dot warn'} />
        <b>{source.name}</b>
        <small>
          {KIND_LABEL[source.kind]}
          {source.healthy ? '' : ' · đang tạm ngừng'}
          {source.name === answering ? ' · đang trả lời' : ''}
        </small>
        {chosen === source.name ? <Check className="picker-tick" /> : null}
      </button>)}
      {/* Nguồn chưa bật vẫn hiện, kèm lý do: danh sách thiếu tên trông như lỗi. */}
      {inactive.map((source) => <button key={source.name} type="button" disabled className="off" title={source.hint}>
        <span className="dot off" /><b>{source.name}</b><small>{source.hint}</small>
      </button>)}
    </div> : null}
  </div>;
}
const THEMES: { value: Theme; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: 'dark', label: 'Tối', hint: 'nền tối, dịu mắt buổi đêm', Icon: Moon },
  { value: 'light', label: 'Sáng', hint: 'nền sáng, rõ dưới đèn', Icon: Sun },
  { value: 'system', label: 'Theo máy', hint: 'đi theo cài đặt hệ thống', Icon: Monitor },
];

/**
 * Nút đổi chế độ sáng/tối.
 *
 * Ở `system`, nút hiện biểu tượng màn hình chứ không hiện mặt trời/mặt trăng: người
 * dùng cần biết mình đang *thả theo máy* hay đang *ghim* một chủ đề — chủ đề đang
 * thấy thì nhìn cả trang là biết rồi. Chủ đề máy đang chọn nằm trong tooltip.
 *
 * `activeTheme` được đăng ký riêng vì đổi cài đặt máy không làm `themeChoice` khác đi;
 * chỉ theo dõi lựa chọn thì tooltip đứng im ở giá trị cũ.
 */
export function ThemePicker() {
  const { open, setOpen, box } = useDropdown();
  const choice = useSyncExternalStore(subscribeTheme, themeChoice, () => 'system' as Theme);
  const active = useSyncExternalStore(subscribeTheme, activeTheme, () => 'dark' as const);
  const current = THEMES.find((theme) => theme.value === choice) ?? THEMES[0];
  const Glyph = current.Icon;

  return <div className="picker" ref={box}>
    <button
      type="button" className="icon-button picker-button" onClick={() => setOpen(!open)}
      aria-expanded={open} aria-haspopup="menu" aria-label="Chế độ hiển thị"
      title={choice === 'system'
        ? `Chế độ hiển thị: theo máy (đang ${active === 'light' ? 'sáng' : 'tối'})`
        : `Chế độ hiển thị: ${current.label.toLowerCase()}`}
    >
      <Glyph />
      <ChevronDown className="picker-caret" />
    </button>
    {open ? <div className="picker-menu compact" role="menu">
      {THEMES.map(({ value, label, hint, Icon }) => <button
        key={value} type="button" role="menuitemradio" aria-checked={choice === value}
        className={choice === value ? 'on' : ''} onClick={() => { setOpen(false); setTheme(value); }}
      >
        <Icon className="picker-glyph" />
        <b>{label}</b><small>{hint}</small>
        {choice === value ? <Check className="picker-tick" /> : null}
      </button>)}
    </div> : null}
  </div>;
}
