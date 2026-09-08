/**
 * Cache phía server cho các route chỉ đọc: Redis thật khi có `REDIS_URL`,
 * lùi về Map trong RAM khi không có (dev local, hoặc Redis chết giữa chừng).
 *
 * Vì sao cần thêm lớp này dù trình duyệt đã có Cache-Control (xem `http.ts`):
 * Cache-Control chỉ giúp *trình duyệt đó* đỡ gọi lại — mỗi người dùng mới, mỗi
 * F5 sau khi hết hạn, mỗi preview deployment mới đều đánh thẳng vào Postgres
 * (Supabase free, pool ~10) và nguồn ngoài. Cache ở đây để câu trả lời đắt
 * (`catalog.home` join phim + tập + người, `listMovies` COUNT + 5 subquery
 * json_agg mỗi dòng) chỉ tính một lần cho mọi client trong vòng TTL.
 *
 * Luật an toàn:
 * - Chỉ route GET chỉ-đọc, dữ liệu chung (không theo deviceId) mới được bọc.
 *   Route trả 202 "đang nhập", route ghi, route cá nhân (favorites, progress)
 *   KHÔNG đi qua đây — cache lại là đóng băng đúng cái đang chạy.
 * - Lỗi loader (throw) không bao giờ được ghi vào cache: `serverCachedRoute`
 *   chỉ set sau khi đã có body trong tay.
 * - Redis mất giữa chừng thì rớt về RAM trong suốt, không ném lỗi ra route.
 */
import { createClient, type RedisClientType } from 'redis';

const DEFAULT_TTL = Number(process.env.CACHE_DEFAULT_TTL ?? 60);
const MAX_MEMORY_KEYS = Number(process.env.CACHE_MEMORY_MAX_KEYS ?? 500);

/** Một ngăn RAM có hạn dùng, đủ cho dev và làm lưới đỡ khi Redis hắt hơi. */
class MemoryStore {
  private readonly items = new Map<string, { value: string; expiresAt: number }>();

  get(key: string): string | null {
    const found = this.items.get(key);
    if (!found) return null;
    if (found.expiresAt <= Date.now()) {
      this.items.delete(key);
      return null;
    }
    return found.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    if (this.items.size >= MAX_MEMORY_KEYS) {
      const oldest = this.items.keys().next();
      if (!oldest.done) this.items.delete(oldest.value);
    }
    this.items.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(prefix: string): void {
    for (const key of this.items.keys()) {
      if (key.startsWith(prefix)) this.items.delete(key);
    }
  }
}

const memory = new MemoryStore();
let redis: RedisClientType | null = null;
let redisDown = false;

/** Mở kết nối Redis ở nền, không chặn boot — DB ngủ đã từng làm sập cả API. */
if (process.env.REDIS_URL) {
  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (error) => {
    if (!redisDown) console.warn('Redis lỗi, tạm dùng cache RAM:', (error as Error).message);
    redisDown = true;
  });
  client.on('ready', () => {
    if (redisDown) console.log('Redis đã trở lại');
    redisDown = false;
  });
  client.connect().catch((error: Error) => {
    console.warn('Không nối được Redis lúc khởi động, dùng cache RAM:', error.message);
    redisDown = true;
  });
  redis = client as RedisClientType;
} else {
  console.log('Chưa đặt REDIS_URL — cache server dùng RAM (đủ cho dev, lên Railway/Upstash thì đặt để share giữa các instance)');
}

export const cacheBackend = (): 'redis' | 'memory' => (redis && !redisDown ? 'redis' : 'memory');

export async function cacheGet(key: string): Promise<string | null> {
  if (redis && !redisDown) {
    try {
      return await redis.get(key);
    } catch (error) {
      redisDown = true;
      console.warn('Redis GET lỗi, rớt về RAM:', (error as Error).message);
    }
  }
  return memory.get(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds = DEFAULT_TTL): Promise<void> {
  if (redis && !redisDown) {
    try {
      await redis.set(key, value, { EX: ttlSeconds });
      return;
    } catch (error) {
      redisDown = true;
      console.warn('Redis SET lỗi, rớt về RAM:', (error as Error).message);
    }
  }
  memory.set(key, value, ttlSeconds);
}

/** Xoá theo tiền tố, dùng sau khi sync/import xong để nội dung mới hiện ngay. */
export async function cacheInvalidate(prefix: string): Promise<void> {
  memory.del(prefix);
  if (redis && !redisDown) {
    try {
      // SCAN thay vì KEYS để không chặn Redis khi key nhiều.
      for await (const key of redis.scanIterator({ MATCH: `${prefix}*` })) {
        await redis.del(key);
      }
    } catch (error) {
      console.warn('Redis DEL lỗi:', (error as Error).message);
    }
  }
}

/**
 * Khoá cache cho một request: path + query đã sắp xếp để `?page=1&limit=24`
 * và `?limit=24&page=1` dùng chung một ngăn.
 */
export function routeKey(prefix: string, query: unknown): string {
  const params = query && typeof query === 'object' ? query as Record<string, unknown> : {};
  const parts = Object.keys(params).sort().map((name) => `${name}=${String(params[name] ?? '')}`);
  return `web:${prefix}:${parts.join('&')}`;
}
