import { getSyncState, setSyncState, upsertMovie } from './db.js';
import { catalog } from './providers/index.js';

let running = false;

/**
 * Đồng bộ danh sách cho trang chủ: chỉ các trang `/danh-sach/phim-moi-cap-nhat`
 * ở mức thẻ phim (metadata), không kéo detail từng phim.
 *
 * Detail + tập giờ do trình duyệt kéo thẳng từ VSMOV và gửi về qua
 * `POST /api/ingest/movies` khi người dùng thực sự mở phim — đúng nghĩa "phim
 * nào được xem thì kho có phim đó". Bulk sync detail từng phim (lô 4, hàng
 * trăm request tới nguồn) vừa chậm vừa đập vào provider, và trên Railway thì
 * còn bị chặn IP hoàn toàn.
 */
export async function syncLatest(maxPages?: number) {
  if (running) return getSyncState();
  running = true;
  await setSyncState({ status: 'running', page: 0, processed: 0, error: null });
  try {
    const first = await catalog.latest(1);
    const totalPages = Math.min(Number(first.pagination?.totalPages ?? 1), maxPages ?? 8);
    await setSyncState({ total_pages: totalPages });
    let processed = 0;
    for (let page = 1; page <= totalPages; page++) {
      const payload = page === 1 ? first : await catalog.latest(page);
      const items = payload.items ?? [];
      for (const item of items) {
        // Bản list là tập con của bản detail; ghi lẫn vào không phá gì (upsert
        // theo slug) và lấp nhanh kho cho trang chủ khi nguồn cho phép.
        await upsertMovie(item).catch(() => undefined);
      }
      processed += items.length;
      await setSyncState({ page, processed });
    }
    await setSyncState({ status: 'completed' });
    return getSyncState();
  } catch (error) {
    await setSyncState({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally { running = false; }
}
