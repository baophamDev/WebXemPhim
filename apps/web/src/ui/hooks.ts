/** Hook dùng chung, không gắn với một mảnh giao diện nào. */
import { useEffect, useRef, useState } from 'react';

/** Chờ người dùng ngừng gõ trước khi gọi API — tránh một request mỗi ký tự. */
export function useDebounced<T>(value: T, delay = 320) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * Menu tự đóng khi bấm ra ngoài hoặc bấm Escape. Gắn `ref` vào khung ngoài cùng của
 * menu, phần bên trong khung đó không tính là "ra ngoài".
 *
 * Dùng `pointerdown` chứ không phải `click`: cú bấm ra ngoài có thể rơi vào một link
 * và đổi trang ngay, lúc đó `click` trên document không kịp chạy và menu dính lại ở
 * trang mới.
 */
export function useDropdown() {
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
