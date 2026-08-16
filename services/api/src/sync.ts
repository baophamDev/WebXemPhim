import { getSyncState, setSyncState, upsertEpisodes, upsertMovie } from './db.js';
import { vsmov } from './vsmov.js';
let running = false;
export async function syncLatest(maxPages?: number) {
  if (running) return getSyncState(); running = true; setSyncState({ status: 'running', page: 0, processed: 0, error: null });
  try {
    const first = await vsmov.latest(1); const totalPages = Math.min(Number(first.pagination?.totalPages ?? 1), maxPages ?? 8); setSyncState({ total_pages: totalPages }); let processed = 0;
    for (let page = 1; page <= totalPages; page++) { const payload = page === 1 ? first : await vsmov.latest(page); for (const item of payload.items ?? []) { const movieId = upsertMovie(item); try { const detail = await vsmov.detail(item.slug); upsertMovie(detail.movie); upsertEpisodes(movieId, detail.episodes); } catch { /* retain list metadata when an individual detail is unavailable */ } processed++; } setSyncState({ page, processed }); }
    setSyncState({ status: 'completed' }); return getSyncState();
  } catch (error) { setSyncState({ status: 'failed', error: error instanceof Error ? error.message : String(error) }); throw error; } finally { running = false; }
}
