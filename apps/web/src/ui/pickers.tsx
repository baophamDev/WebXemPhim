/**
 * Nút chọn chế độ sáng/tối trong header.
 */
import { useSyncExternalStore } from 'react';
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { activeTheme, setTheme, subscribeTheme, themeChoice, type Theme } from '../theme';
import { useDropdown } from './hooks';

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
