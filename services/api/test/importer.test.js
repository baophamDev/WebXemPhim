/**
 * Hàng đợi nhập phim: gộp theo slug, giới hạn số job chạy song song, báo chặng, và
 * ngữ nghĩa của một job đã đổ.
 *
 * Ở đây không có DB và cũng không có nguồn ngoài nào: worker là một promise do test
 * tự mở khoá (`deferred()`), nên thứ được kiểm là **hàng đợi**, không phải việc nhập.
 * Nhờ vậy không cần `setTimeout` dài để đợi "cho nó xong".
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  forgetImport, importJob, importQueueSize, resetImports, startImport, waitForImport
} = await import('../dist/importer.js');

/** Promise mà test tự quyết định lúc nào xong — thay cho một lần nhập thật. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}

const wait = (ms = 0) => new Promise((done) => setTimeout(done, ms));

test('cùng một slug chỉ có một job, dù được xin nhiều lần', async () => {
  resetImports();
  const gate = deferred();
  let runs = 0;
  const worker = () => { runs += 1; return gate.promise; };
  const first = startImport('dien-hy-cong-luoc', worker);
  const second = startImport('dien-hy-cong-luoc', worker);
  // Web poll 1.5 giây/lần: không gộp thì mỗi lần poll lại mở một chuỗi request mới
  // tới nguồn ngoài cho đúng một phim.
  assert.equal(runs, 1);
  assert.equal(second.startedAt, first.startedAt);
  assert.deepEqual(importQueueSize(), { running: 1, queued: 0, tracked: 1 });
  gate.resolve();
  await waitForImport('dien-hy-cong-luoc');
  assert.equal(importJob('dien-hy-cong-luoc').stage, 'ready');
  const retry = deferred();
  const again = startImport('dien-hy-cong-luoc', () => { runs += 1; return retry.promise; });
  // Job cũ đã xong thì "nhập lại" phải thật sự nhập lại, không trả về job cũ.
  assert.equal(runs, 2);
  assert.equal(again.stage, 'queued');
  retry.resolve();
  await waitForImport('dien-hy-cong-luoc');
});

test('quá MAX_RUNNING thì job ở lại hàng đợi, xong một cái mới tới lượt cái sau', async () => {
  resetImports();
  const gates = [];
  const started = [];
  for (let index = 0; index < 8; index += 1) {
    const gate = deferred();
    gates.push(gate);
    startImport(`phim-${index}`, () => { started.push(index); return gate.promise; });
  }
  // Sáu chạy, hai chờ. Đây là chỗ duy nhất chặn được việc một người mở 50 phim liền
  // tay biến thành 50 chuỗi request tới nguồn ngoài.
  assert.deepEqual(importQueueSize(), { running: 6, queued: 2, tracked: 8 });
  assert.deepEqual(started, [0, 1, 2, 3, 4, 5]);
  gates[0].resolve();
  await waitForImport('phim-0');
  assert.deepEqual(started, [0, 1, 2, 3, 4, 5, 6], 'trả slot xong là job kế tiếp chạy ngay');
  assert.deepEqual(importQueueSize(), { running: 6, queued: 1, tracked: 8 });
  for (const gate of gates) gate.resolve();
  await Promise.all(gates.map((_, index) => waitForImport(`phim-${index}`)));
  // Job đã xong vẫn nằm lại (KEEP_SETTLED_MS) cho client kịp đọc kết quả.
  assert.deepEqual(importQueueSize(), { running: 0, queued: 0, tracked: 8 });
});

test('báo chặng: chặng cuối do hàng đợi đặt, worker báo muộn không lật được', async () => {
  resetImports();
  const gate = deferred();
  let report;
  startImport('truong-ca-hanh', (send) => { report = send; return gate.promise; });
  report('playable', 'vsmov');
  let job = importJob('truong-ca-hanh');
  assert.equal(job.stage, 'playable');
  assert.equal(job.source, 'vsmov');
  report('enrich', 'tmdb');
  assert.equal(importJob('truong-ca-hanh').stage, 'enrich');
  gate.resolve();
  await waitForImport('truong-ca-hanh');
  job = importJob('truong-ca-hanh');
  assert.equal(job.stage, 'ready');
  assert.equal(job.source, null, 'xong rồi thì không còn nguồn nào đang được hỏi');
  assert.equal(job.error, null);
  // Worker vẫn giữ `report` sau khi promise của nó đã xong. Lật `ready` về một chặng
  // giữa thì thanh tiến trình chạy lại từ đầu cho một phim đã nhập xong.
  report('metadata', 'tvdb');
  assert.equal(importJob('truong-ca-hanh').stage, 'ready');
});

test('job đổ: giữ lại lỗi gốc, và forgetImport chỉ bỏ job đã settle', async () => {
  resetImports();
  const gate = deferred();
  startImport('phim-hong', () => gate.promise);
  // Đang chạy thì không được bỏ: xoá entry giữa đường là `pump()` mất chỗ trả slot,
  // và hàng đợi tắc vĩnh viễn ở đúng chỗ đó.
  forgetImport('phim-hong');
  assert.equal(importQueueSize().tracked, 1);
  const boom = Object.assign(new Error('Nguồn vsmov trả HTTP 502'), { status: 502 });
  gate.reject(boom);
  await assert.rejects(() => waitForImport('phim-hong'), (error) => {
    // `?wait=1` phải giữ nguyên lỗi gốc: 404 phim không tồn tại khác 502 nguồn chết.
    assert.equal(error, boom);
    assert.equal(error.status, 502);
    return true;
  });
  const job = importJob('phim-hong');
  assert.equal(job.stage, 'failed');
  assert.equal(job.error, 'Nguồn vsmov trả HTTP 502');
  // Không bỏ job đã đổ thì mỗi lần bấm "Thử lại" chỉ nhận lại đúng lỗi cũ.
  forgetImport('phim-hong');
  assert.equal(importJob('phim-hong'), null);
  assert.equal(importQueueSize().tracked, 0);
});

test('không có job thì coi như đã xong; job đã settle thì elapsedMs đứng lại', async () => {
  resetImports();
  // Phim đã có trong DB không mở job nào, mà `?wait=1` vẫn phải trả lời ngay.
  await waitForImport('chua-tung-nhap');
  assert.equal(importJob('chua-tung-nhap'), null);

  const gate = deferred();
  startImport('phim-do-thoi-gian', () => gate.promise);
  const early = importJob('phim-do-thoi-gian').elapsedMs;
  await wait(12);
  // Đang chạy: web đếm giây từ con số này nên nó phải lớn dần.
  assert.ok(importJob('phim-do-thoi-gian').elapsedMs > early);
  gate.resolve();
  await waitForImport('phim-do-thoi-gian');
  const settled = importJob('phim-do-thoi-gian').elapsedMs;
  await wait(12);
  // Xong rồi thì đây là *thời gian đã nhập*, không phải một đồng hồ chạy tiếp.
  assert.equal(importJob('phim-do-thoi-gian').elapsedMs, settled);
});


