/**
 * Script nhập liệu một lần cho DB mới: chạy syncLatest() của API từ máy local
 * (nơi VSMOV không chặn) thay vì phải mở dev server rồi POST /api/sync/start.
 *
 * Cách chạy: node scripts/sync-from-local.mjs [số trang, mặc định 8]
 */
import 'dotenv/config';
import { closeDatabase, getSyncState, initDatabase } from '../services/api/dist/db.js';
import { syncLatest } from '../services/api/dist/sync.js';

const pages = Number(process.argv[2] ?? 8);

await initDatabase();
console.log('DB sẵn sàng, bắt đầu sync', pages, 'trang...');
try {
  const state = await syncLatest(pages);
  console.log('Kết quả sync:', JSON.stringify(state));
} catch (error) {
  console.error('Sync thất bại:', error?.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
