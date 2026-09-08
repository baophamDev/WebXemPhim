/**
 * Hero tự xoay phim: mỗi 10 giây nhảy sang phim kế tiếp trong danh sách, vòng
 * lại từ đầu khi hết. Ghim cửa sổ, tạm dừng khi rời thẻ, và tôn trọng
 * prefers-reduced-motion (đứng yên ở phim đầu — nội dung vẫn đủ, chỉ mất nhịp).
 */
import { useEffect, useState } from 'react';
import { stillMotion } from './format';

/** Khoảng giữa hai lần nhảy, đủ đọc trọn nhãn + vài dòng mô tả của panel. */
const HERO_AUTO_MS = 10_000;

export function useHeroRotation<T>(items: T[], paused = false) {
  const [index, setIndex] = useState(0);

  // Danh sách đổi (data mới về, đổi route) thì đưa phim hiện về đầu và xoay lại.
  useEffect(() => { setIndex(0); }, [items]);

  useEffect(() => {
    if (paused || items.length < 2 || stillMotion()) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % items.length), HERO_AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, items]);

  return index;
}
