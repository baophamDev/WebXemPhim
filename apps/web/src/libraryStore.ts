/**
 * Nối mô hình thư viện (`library.ts`) với localStorage và React.
 *
 * Nguyên tắc ghi: **máy trước, API sau**. Hai bản ghi là hai nguồn độc lập — mất
 * mạng vẫn giữ được phim đã lưu và chỗ đang xem; còn khi API sống thì phía API
 * cũng có bản ghi (để đồng bộ giữa các thiết bị). Trang Thư viện gộp cả hai.
 *
 * Dùng `useSyncExternalStore` thay vì Redux: dữ liệu này chỉ đổi khi người dùng
 * bấm lưu phim hoặc xem phim, không phải luồng dữ liệu của ứng dụng.
 */
import { useSyncExternalStore } from 'react';
import {
  addFavorite, addProgress, dropFavorite, parseLibrary, serializeLibrary, LIBRARY_STORAGE_KEY,
  type LibraryState, type ProgressEntry, type SavedEntry
} from './library';
import type { MoviePreview } from './preview';

const storage = (): Storage | null => {
  try { return window.localStorage; } catch { return null; }
};

const load = (): LibraryState => {
  const box = storage();
  return parseLibrary(box ? box.getItem(LIBRARY_STORAGE_KEY) : null);
};

let state: LibraryState = load();
const listeners = new Set<() => void>();

/** Ảnh chụp cho React: mảng đã sắp xếp, chỉ dựng lại khi có ghi. */
function snapshotOf(current: LibraryState) {
  return {
    favorites: Object.values(current.favorites).sort((a, b) => b.savedAt - a.savedAt),
    progress: Object.values(current.progress).sort((a, b) => b.updatedAt - a.updatedAt)
  };
}
let snapshot = snapshotOf(state);

function commit(next: LibraryState) {
  state = next;
  snapshot = snapshotOf(state);
  const box = storage();
  if (box) {
    try { box.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(state)); }
    catch { /* hết chỗ hoặc bị chặn: giữ bản trong RAM, lần mở sau coi như trống */ }
  }
  for (const listener of listeners) listener();
}

export function subscribeLibrary(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const librarySnapshot = () => snapshot;

/** Phim đã lưu + tiến trình trên thiết bị này. */
export function useLibrary(): { favorites: SavedEntry[]; progress: ProgressEntry[] } {
  return useSyncExternalStore(subscribeLibrary, librarySnapshot, librarySnapshot);
}

export function saveFavorite(movie: MoviePreview) {
  if (movie?.slug) commit(addFavorite(state, movie));
}

export function removeFavorite(slug: string) {
  commit(dropFavorite(state, slug));
}

export function recordProgress(entry: ProgressEntry) {
  if (entry?.movie?.slug) commit(addProgress(state, entry));
}

/** Tab khác ghi thì tab này thấy — hai tab mở cùng lúc là chuyện thường. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LIBRARY_STORAGE_KEY) commit(load());
  });
}
