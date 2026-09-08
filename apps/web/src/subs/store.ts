/**
 * Chỗ ở của phụ đề người xem tự gắn: IndexedDB của chính trình duyệt họ.
 *
 * Vì sao không lưu ở máy chủ: sub gắn tay là việc riêng của từng người — một người
 * gắn bản dịch lệch 3 giây thì không có lý gì cả nhà cùng phải xem bản lệch đó. Đổi
 * lại, sub gắn trên máy tính thì TV LG không thấy; đó là đánh đổi đã biết trước.
 *
 * Vì sao IndexedDB mà không localStorage: một file sub 2000 cue nặng ~150KB, mà
 * localStorage chỉ có ~5MB cho **cả** origin và ghi thì đồng bộ (chặn luồng chính
 * giữa lúc phim đang chạy). IndexedDB không chặn và tính bằng trăm MB.
 *
 * Nguyên tắc của cả file: **không bao giờ ném lỗi ra ngoài**. Chế độ riêng tư của
 * Safari, webOS bản cũ, hay người dùng chặn storage đều làm IndexedDB đổ — lúc đó rơi
 * xuống Map trong RAM: sub vẫn gắn được cho lần xem này, chỉ là đóng tab thì mất, và
 * `isPersistent()` cho UI nói trước điều đó thay vì để người xem tự phát hiện.
 */
import type { SubtitleFormat } from './convert';

/** Nguồn của track — hiện lên UI, và để biết cái nào tải lại được nếu mất. */
export type TrackSource = 'file' | 'url' | 'opensubtitles' | 'subdl';

export interface StoredTrack {
  id: string;
  /** Khoá tra cứu chính: sub thuộc về **tập**, không phải phim. */
  episodeId: number;
  /** Để còn dọn theo phim và để hiện "sub của phim này" khi đổi tập. */
  movieSlug: string;
  label: string;
  lang: string;
  format: SubtitleFormat;
  /** Đã là WebVTT sạch (xem `convert.ts`) — không lưu bản gốc, lưu hai lần vô ích. */
  vtt: string;
  /** Giây, âm là sub hiện sớm hơn. Người xem sửa được, nên lưu riêng khỏi `vtt`. */
  offset: number;
  source: TrackSource;
  createdAt: number;
  encoding: string;
  cues: number;
}

const DB_NAME = 'cinema-subs';
const DB_VERSION = 1;
const STORE = 'tracks';
const INDEX = 'byEpisode';
/**
 * Trần dung lượng tự dọn. Không có trần thì một người xem cả bộ 60 tập sẽ để lại 60
 * file sub trong máy vĩnh viễn; dọn theo `createdAt` nên cái đang xem không bị mất.
 */
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_TRACKS = 200;
/** Safari riêng tư có khi mở IndexedDB rồi **không** gọi lại callback nào cả. */
const OPEN_TIMEOUT_MS = 4_000;

const fallback = new Map<string, StoredTrack>();
let degraded = false;

/** UI cần biết để cảnh báo trước: `false` nghĩa là đóng tab là mất sub. */
export const isPersistent = () => !degraded;

let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); } catch { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), OPEN_TIMEOUT_MS);
    const finish = (db: IDBDatabase | null) => { clearTimeout(timer); resolve(db); };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex(INDEX, 'episodeId');
      }
    };
    request.onsuccess = () => finish(request.result);
    request.onerror = () => finish(null);
    // Tab khác đang giữ phiên bản cũ của DB: không chờ, cứ chạy bằng RAM.
    request.onblocked = () => finish(null);
  });
  return opening;
}

/**
 * Một lượt đọc/ghi. Trả `{ok:false}` cho **mọi** kiểu hỏng (không mở được DB, hết
 * quota, transaction bị abort) để chỗ gọi chỉ phải xử một nhánh lỗi duy nhất.
 */
async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest): Promise<{ ok: boolean; value?: T }> {
  const db = await openDb();
  if (!db) { degraded = true; return { ok: false }; }
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.onabort = () => resolve({ ok: false });
      transaction.onerror = () => resolve({ ok: false });
      // Ghi thì chỉ chắc khi transaction commit xong: hết quota làm nó abort **sau**
      // khi request đã success, tin vào success là báo "đã lưu" cho thứ chưa lưu.
      if (mode === 'readwrite') transaction.oncomplete = () => resolve({ ok: true, value: request.result as T });
      else request.onsuccess = () => resolve({ ok: true, value: request.result as T });
    } catch { resolve({ ok: false }); }
  });
}

/** `crypto.randomUUID` không có ngoài secure context — mở web qua IP LAN là mất nó. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Mới nhất lên đầu: người xem vừa gắn thì muốn thấy nó ngay. */
const newestFirst = (list: StoredTrack[]) => list.sort((left, right) => right.createdAt - left.createdAt);

const fromMemory = (episodeId?: number) => newestFirst(
  [...fallback.values()].filter((track) => episodeId === undefined || track.episodeId === episodeId)
);

export async function listTracks(episodeId: number): Promise<StoredTrack[]> {
  const result = await run<StoredTrack[]>('readonly', (store) => store.index(INDEX).getAll(episodeId));
  if (!result.ok) { degraded = true; return fromMemory(episodeId); }
  return newestFirst(result.value ?? []);
}

export async function listAllTracks(): Promise<StoredTrack[]> {
  const result = await run<StoredTrack[]>('readonly', (store) => store.getAll());
  if (!result.ok) { degraded = true; return fromMemory(); }
  return newestFirst(result.value ?? []);
}

export interface NewTrack extends Omit<StoredTrack, 'id' | 'createdAt' | 'offset'> { offset?: number }

/** Thêm một track. Trả về bản đã lưu (kèm `id`) để UI bật nó lên ngay, không phải đọc lại. */
export async function addTrack(input: NewTrack): Promise<StoredTrack> {
  const track: StoredTrack = { ...input, offset: input.offset ?? 0, id: newId(), createdAt: Date.now() };
  const result = await run('readwrite', (store) => store.put(track));
  if (!result.ok) { degraded = true; fallback.set(track.id, track); return track; }
  await enforceQuota();
  return track;
}

export async function updateTrack(id: string, patch: Partial<StoredTrack>): Promise<StoredTrack | null> {
  const current = await getTrack(id);
  if (!current) return null;
  const next = { ...current, ...patch, id: current.id };
  const result = await run('readwrite', (store) => store.put(next));
  if (!result.ok) { degraded = true; fallback.set(id, next); }
  return next;
}

export async function getTrack(id: string): Promise<StoredTrack | null> {
  const result = await run<StoredTrack | undefined>('readonly', (store) => store.get(id));
  if (!result.ok) { degraded = true; return fallback.get(id) ?? null; }
  return result.value ?? null;
}

export async function deleteTrack(id: string): Promise<void> {
  const result = await run('readwrite', (store) => store.delete(id));
  if (!result.ok) degraded = true;
  fallback.delete(id);
}

/**
 * Cỡ xấp xỉ của một track: đếm ký tự (UTF-16) chứ không encode ra byte thật. Con số
 * này chỉ dùng để so với trần dung lượng, mà encode cả 200 file mỗi lần dọn thì tốn
 * hơn phần tiết kiệm được. Chữ Việt ở UTF-8 nặng hơn khoảng 1.4 lần, nên trần thực tế
 * chặt hơn `MAX_BYTES` một chút — lệch về phía an toàn.
 */
export const trackSize = (track: StoredTrack) => track.vtt.length;

/** Cho UI hiện "đang dùng ~2.1 MB" và cái nút dọn hết. */
export async function storageUsed(): Promise<{ tracks: number; bytes: number }> {
  const all = await listAllTracks();
  return { tracks: all.length, bytes: all.reduce((total, track) => total + trackSize(track), 0) };
}

/**
 * Dọn bớt khi vượt trần. Xoá từ **cũ nhất**: track vừa gắn nằm đầu danh sách nên
 * không bao giờ là thứ bị hy sinh, kể cả khi chính nó làm vượt trần.
 */
async function enforceQuota(): Promise<void> {
  const all = await listAllTracks();
  if (all.length <= MAX_TRACKS && all.reduce((total, track) => total + trackSize(track), 0) <= MAX_BYTES) return;
  let used = 0;
  const doomed: string[] = [];
  all.forEach((track, index) => {
    used += trackSize(track);
    if (index >= MAX_TRACKS || used > MAX_BYTES) doomed.push(track.id);
  });
  for (const id of doomed) await deleteTrack(id);
}

/**
 * Lựa chọn của người xem thì để localStorage: nó đồng bộ nên đọc được **ngay** lúc
 * dựng player, không phải chờ một vòng promise rồi mới bật sub — chờ là người xem thấy
 * phụ đề nhảy vào sau vài trăm ms mỗi lần mở tập.
 *
 * Mỗi tập một key thay vì một map JSON: ghi một tập không phải đọc–sửa–ghi cả map, nên
 * hai tab mở hai tập khác nhau không ghi đè lựa chọn của nhau.
 */
const ACTIVE_PREFIX = 'cinema-sub-active:';
const SIZE_KEY = 'cinema-sub-size';

export type CueSize = 'sm' | 'md' | 'lg';

const readLocal = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeLocal = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* chặn storage thì bỏ qua */ } };

/** Track đang bật cho tập này; chuỗi rỗng nghĩa là tắt phụ đề. */
export const readActiveTrack = (episodeId: number) => readLocal(`${ACTIVE_PREFIX}${episodeId}`) ?? '';
export const writeActiveTrack = (episodeId: number, id: string) => writeLocal(`${ACTIVE_PREFIX}${episodeId}`, id);

export function readCueSize(): CueSize {
  const saved = readLocal(SIZE_KEY);
  return saved === 'sm' || saved === 'lg' ? saved : 'md';
}
export const writeCueSize = (size: CueSize) => writeLocal(SIZE_KEY, size);
