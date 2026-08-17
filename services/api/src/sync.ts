import { getSyncState, setSyncState, upsertEpisodes, upsertMovie } from './db.js';
import { catalogProvider } from './providers/index.js';

let running = false;

export async function syncLatest(maxPages?: number) {
  if (running) return getSyncState();
  running = true;
  await setSyncState({ status: 'running', page: 0, processed: 0, error: null });
  try {
    const first = await catalogProvider.latest(1);
    const totalPages = Math.min(Number(first.pagination?.totalPages ?? 1), maxPages ?? 8);
    await setSyncState({ total_pages: totalPages });
    let processed = 0;
    for (let page = 1; page <= totalPages; page++) {
      const payload = page === 1 ? first : await catalogProvider.latest(page);
      for (const item of payload.items ?? []) {
        const movieId = await upsertMovie(item);
        try {
          const detail = await catalogProvider.detail(item.slug);
          await upsertMovie(detail.movie);
          await upsertEpisodes(movieId, detail.episodes);
        } catch { /* retain list metadata when an individual detail is unavailable */ }
        processed++;
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
