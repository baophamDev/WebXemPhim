/**
 * Gọi thẳng NguonC từ trình duyệt.
 *
 * Đây là nguồn **chính** của đường dự phòng: VSMOV trả `link_m3u8` rỗng ở mọi tập
 * và embed của nó (s2.streamvsmov.com) đã 522 + tự chặn iframe, nên dữ liệu
 * VSMOV chỉ còn dùng được cho phần chữ. NguonC trả embed thật (`embed*.streamc.xyz`)
 * và cùng nguồn đó cũng có thể loại/quốc gia/năm để dựng menu.
 *
 * Không đưa vào RTK Query: baseQuery của cinemaApi nhắm vào API của mình (kèm cơ
 * chế claimBoot), còn đây là nguồn ngoài hoàn toàn — tách hook riêng (`useNguonc`).
 */
import { vsmovSearch, vsmovTaxonomy, type IngestPayload } from './vsmov';
import {
  episodesFromNguonc, episodesFromPayload, listFromNguonc, nguoncDetailPath, nguoncPath, nguoncTaxonomy, NGUONC_GENRES
} from './nguoncMap';
import type { CatalogTarget } from './catalogFallback';
import type { MovieList } from './types';

const NGUONC_API_URL = (import.meta.env.VITE_NGUONC_API_URL ?? 'https://phim.nguonc.com/api').replace(/\/$/, '');

async function getJson(path: string): Promise<any> {
  const response = await fetch(`${NGUONC_API_URL}${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nguồn nguonc trả HTTP ${response.status}`);
  return response.json();
}

/** Một trang danh sách theo đường đã dịch từ URL kiểu VSMOV. */
export async function nguoncList(path: string, limit = 24): Promise<MovieList> {
  return listFromNguonc(await getJson(path), limit);
}

/**
 * Tìm kiếm bên NguonC, không có kết quả thì thử tiếp VSMOV: kho VSMOV rộng hơn,
 * thà thêm kết quả còn hơn trả một trang trắng.
 */
export async function nguoncSearch(keyword: string, page = 1, limit = 24): Promise<MovieList> {
  const search = new URLSearchParams({ keyword, page: String(page) });
  const found = await nguoncList(`/films/search?${search}`, limit);
  if (found.items.length || page > 1) return found;
  try { return await vsmovSearch(keyword, page, limit); } catch { return found; }
}

/** Chi tiết một phim: đủ thông tin + nhóm tập embed để xem ngay và để ingest. */
export async function nguoncDetail(slug: string): Promise<IngestPayload> {
  const detail = episodesFromPayload(await getJson(nguoncDetailPath(slug)), slug);
  if (!detail) throw new Error(`Nguồn nguonc không trả về phim cho slug "${slug}"`);
  return detail;
}

/** Chặng nào lỗi thì coi như nguồn đó không có, không kéo đổ cả menu. */
async function optional<T>(run: () => Promise<T>): Promise<T | null> {
  try { return await run(); } catch { return null; }
}

/**
 * Chạy một `CatalogTarget` bằng NguonC, trả về **đúng shape mà API mình trả** cho
 * route đó. Ném lỗi khi NguonC không có đường tương ứng (quốc gia, năm) — `api.ts`
 * bắt lấy rồi rơi tiếp xuống VSMOV.
 */
export async function nguoncTarget(target: CatalogTarget): Promise<unknown> {
  if (target.kind === 'navigation') {
    // Menu phải đủ ba cột: thể loại theo NguonC, còn quốc gia/năm vẫn của VSMOV
    // (NguonC không có endpoint liệt kê hai thứ đó).
    const [countries, years] = await Promise.all([
      optional(() => vsmovTaxonomy('/quoc-gia')), optional(() => vsmovTaxonomy('/nam'))
    ]);
    return { genres: NGUONC_GENRES, countries: countries?.items ?? [], years: years?.items ?? [] };
  }
  if (target.kind === 'taxonomy') {
    const taxonomy = nguoncTaxonomy(target.url);
    if (!taxonomy) throw new Error(`NguonC không có danh mục "${target.url}"`);
    return taxonomy;
  }
  if (target.kind === 'detail') {
    const detail = await nguoncDetail(target.slug);
    return { movie: { ...detail.movie, episodes: episodesFromNguonc(detail.episodes) } };
  }
  const path = nguoncPath(target.url);
  if (!path) throw new Error(`NguonC không có đường "${target.url}"`);
  return nguoncList(path, target.limit);
}