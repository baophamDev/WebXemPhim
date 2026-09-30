#!/usr/bin/env node
/**
 * Chờ API mở cổng trước khi Vite khởi động.
 *
 * Vì sao cần: `npm run dev` chạy API và web song song, nhưng Vite sẵn sàng sau
 * ~1s còn `tsx watch` phải biên dịch xong mới `listen()`. Trình duyệt mở trang
 * ngay lúc đó là `index.html` bắn request trước, proxy của Vite đập vào cổng
 * chưa ai nghe và log đầy `AggregateError [ECONNREFUSED]` — vô hại nhưng làm
 * người đọc tưởng API hỏng.
 *
 * Chờ ở đây (thay vì thêm delay mù) nên web chỉ khởi động khi API thật sự trả
 * lời. Hết thời gian chờ thì vẫn mở web: API chết hẳn là chuyện khác, và giao
 * diện đã có sẵn nhánh "API ngoại tuyến".
 *
 *   node scripts/wait-for-api.mjs            # mặc định http://127.0.0.1:4000
 *   API_WAIT_URL=... API_WAIT_MS=5000 node scripts/wait-for-api.mjs
 */

const url = process.env.API_WAIT_URL ?? 'http://127.0.0.1:4000/api/health';
const timeoutMs = Number(process.env.API_WAIT_MS ?? 20_000);
const intervalMs = 250;

async function alive() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
}

const deadline = Date.now() + timeoutMs;
if (!(await alive())) {
  console.log(`[web] đợi API ở ${url} ...`);
  let ready = false;
  while (!ready && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    ready = await alive();
  }
  if (!ready) {
    console.warn(`[web] API chưa trả lời sau ${timeoutMs / 1000}s — vẫn mở Vite; trang sẽ hiện "API ngoại tuyến" cho tới khi API lên.`);
    process.exit(0);
  }
  console.log('[web] API đã sẵn sàng.');
}
