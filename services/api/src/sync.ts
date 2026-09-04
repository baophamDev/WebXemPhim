import { getSyncState, setSyncState, upsertEpisodes, upsertMovie } from './db.js';
import { catalog } from './providers/index.js';

let running = false;
const SYNC_BATCH = 4;

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
      // Xử lý theo lô: trước đây mỗi phim là một chuỗi fetch tuần tự, 8 trang
      // (~200 phim) mất rất lâu. Lô 4 vừa đủ nhanh mà không đập vào provider.
      for (let index = 0; index < items.length; index += SYNC_BATCH) {
        await Promise.all(items.slice(index, index + SYNC_BATCH).map(async (item) => {
          try {
            // Chỉ upsert bản detail: bản list là tập con của nó, upsert 2 lần là thừa.
            const detail = await catalog.detail(item.slug);
            const movieId = await upsertMovie(detail.movie);
            await upsertEpisodes(movieId, detail.episodes);
          } catch {
            // Detail lỗi thì vẫn giữ được metadata từ trang danh sách.
            await upsertMovie(item).catch(() => undefined);
          }
        }));
        processed += Math.min(SYNC_BATCH, items.length - index);
      }
      await setSyncState({ page, processed });
    }
    await setSyncState({ status: 'completed' });
    return getSyncState();
  } catch (error) {
    await setSyncState({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally { running = false; }
}
