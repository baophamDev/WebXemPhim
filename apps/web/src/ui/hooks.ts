/** Hook dùng chung, không gắn với một mảnh giao diện nào. */
import { useEffect, useState } from 'react';

/** Chờ người dùng ngừng gõ trước khi gọi API — tránh một request mỗi ký tự. */
export function useDebounced<T>(value: T, delay = 320) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
