/**
 * Lớp gọi HTTP dùng chung cho các adapter nguồn: timeout, cache theo TTL, và một
 * thông điệp lỗi thống nhất.
 *
 * Cache là in-memory có giới hạn số khoá. Không dùng `Map` không giới hạn như bản
 * cũ: API chạy dài ngày trên Railway, mỗi bộ lọc khác nhau là một khoá mới, nên
 * bản cũ chỉ có một chiều là phình ra. LRU xấp xỉ (xoá khoá cũ nhất khi đầy) đủ
 * cho tải của một site cá nhân.
 */
import { httpError } from '../errors.js';

const CACHE_LIMIT = 500;
const cache = new Map<string, { expires: number; value: unknown }>();

export interface FetchOptions {
  /** Tên nguồn, chỉ để ghép vào thông điệp lỗi. */
  source: string;
  ttlMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export function cacheKey(url: string, headers?: Record<string, string>) {
  // Ngôn ngữ/khoá API nằm ở header hoặc query của từng nguồn nên phải vào khoá,
  // nếu không đổi TMDB_LANGUAGE mà cache vẫn trả bản cũ.
  return headers?.['accept-language'] ? `${url}|${headers['accept-language']}` : url;
}

export async function getJson<T = unknown>(url: string, options: FetchOptions): Promise<T> {
  const { source, ttlMs = 120_000, timeoutMs = 20_000, headers } = options;
  const key = cacheKey(url, headers);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'BaoNhanCinema/0.3', ...headers }
    });
    if (!response.ok) {
      // 401/403 của nguồn là lỗi cấu hình phía mình (thiếu/sai khoá API), không
      // phải nguồn chết — nói rõ để không đi soi mạng vô ích.
      const hint = response.status === 401 || response.status === 403 ? ' (kiểm tra khoá API trong biến môi trường)' : '';
      throw httpError(502, `Nguồn ${source} trả HTTP ${response.status}${hint}`);
    }
    const value = (await response.json()) as T;
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expires: Date.now() + ttlMs, value });
    return value;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw httpError(504, `Nguồn ${source} không trả lời sau ${Math.round(timeoutMs / 1000)}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function queryString(params: Record<string, unknown> | object) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

/** Chỉ dùng trong test: cache dùng chung giữa các ca test thì kết quả phụ thuộc thứ tự chạy. */
export function clearHttpCache() {
  cache.clear();
}
