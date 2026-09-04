/**
 * Hàng đợi nhập phim — để việc điều hướng không phải chờ việc kéo dữ liệu.
 *
 * Trước đây `GET /api/catalog/movies/:slug` gọi thẳng `resolver.detail()` rồi mới
 * trả lời. Phim chưa từng xem thì request đó phải đi qua nhiều nguồn ngoài, mỗi
 * nguồn tới 20 giây timeout — người dùng bấm vào poster và ngồi nhìn một vòng
 * xoay, không biết web còn sống hay không. Sai ở chỗ **thứ tự ưu tiên**: mở được
 * trang chi tiết là việc gấp, kéo đủ metadata thì không.
 *
 * Nên chỗ này tách hai việc đó ra. Route trả về ngay những gì đã có (thường là
 * chưa có gì) kèm trạng thái một job đang chạy ở nền; web vẽ trang chi tiết từ
 * dữ liệu của thẻ phim vừa bấm và hiện tiến trình thật của job. Job xong thì lần
 * poll kế tiếp thấy phim trong DB.
 *
 * Ba tính chất của hàng đợi này, mỗi cái đổi lấy một lỗi đã gặp:
 *
 * 1. **Gộp theo slug.** Mười tab cùng mở một phim vẫn là một job. Không có nó,
 *    poll 1.5 giây/lần sẽ tự nhân bản job cho tới khi nguồn ngoài chặn IP.
 * 2. **Giới hạn số job chạy song song** (`MAX_RUNNING`). Job vượt hạn ở lại chặng
 *    `queued`. Đây là chỗ duy nhất chặn được việc một người mở 50 phim liền tay
 *    biến thành 50 chuỗi request tới nguồn ngoài.
 * 3. **Không giữ rác.** Job đã xong chỉ nằm lại `KEEP_SETTLED_MS` cho client kịp
 *    đọc kết quả, và tổng số job có trần cứng.
 *
 * Registry nằm trong RAM của một tiến trình: chạy nhiều instance thì mỗi instance
 * có hàng đợi riêng. Chấp nhận được — job chỉ là *tiến trình* của một lần nhập,
 * còn kết quả thì nằm ở DB dùng chung, nên instance nào nhập cũng như nhau.
 */
import type { DetailStage } from './providers/types.js';

/**
 * Chặng của một lần nhập. Bốn chặng giữa do resolver báo (`DetailStage`) — chúng
 * là các bước thật của `detail()`, không phải mốc phần trăm bịa ra cho đẹp.
 */
export type ImportStage = 'queued' | DetailStage | 'saving' | 'ready' | 'failed';

export interface ImportJob {
  slug: string;
  stage: ImportStage;
  /** Nguồn đang được hỏi ở chặng này, để web nói được "đang hỏi tvdb". */
  source: string | null;
  startedAt: string;
  updatedAt: string;
  /** Số ms kể từ lúc job vào hàng đợi — web đếm giây mà không cần đồng bộ giờ. */
  elapsedMs: number;
  /** Lý do đổ, chỉ có khi `stage === 'failed'`. */
  error: string | null;
}

/** Hàm báo chặng, truyền vào worker. */
export type Report = (stage: ImportStage, source?: string | null) => void;
type Worker = (report: Report) => Promise<unknown>;

const MAX_RUNNING = 6;
const JOB_LIMIT = 200;
const KEEP_SETTLED_MS = 30_000;

interface Entry {
  slug: string;
  stage: ImportStage;
  source: string | null;
  startedAt: number;
  updatedAt: number;
  settledAt: number | null;
  failure: unknown;
  worker: Worker;
  done: Promise<void>;
  finish: () => void;
  fail: (error: unknown) => void;
}

const entries = new Map<string, Entry>();
const queue: string[] = [];
let running = 0;

const isSettled = (entry: Entry) => entry.settledAt !== null;

function snapshot(entry: Entry): ImportJob {
  return {
    slug: entry.slug,
    stage: entry.stage,
    source: entry.source,
    startedAt: new Date(entry.startedAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
    elapsedMs: (entry.settledAt ?? Date.now()) - entry.startedAt,
    error: entry.failure ? message(entry.failure) : null
  };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Dọn job đã xong. Chỉ dọn job đã settle: job đang chạy mà bị xoá thì `pump()`
 * mất chỗ trả slot và hàng đợi tắc vĩnh viễn.
 */
function prune() {
  const now = Date.now();
  for (const [slug, entry] of entries) {
    if (isSettled(entry) && now - entry.settledAt! > KEEP_SETTLED_MS) entries.delete(slug);
  }
  if (entries.size <= JOB_LIMIT) return;
  for (const [slug, entry] of entries) {
    if (entries.size <= JOB_LIMIT) break;
    if (isSettled(entry)) entries.delete(slug);
  }
}

function pump() {
  while (running < MAX_RUNNING && queue.length) {
    const slug = queue.shift()!;
    const entry = entries.get(slug);
    // Job có thể đã bị bỏ (forgetImport) trong lúc chờ hàng đợi.
    if (!entry || isSettled(entry)) continue;
    running += 1;
    void run(entry);
  }
}

async function run(entry: Entry) {
  const report: Report = (stage, source) => {
    // Job đã settle thì bỏ qua: worker báo muộn không được phép lật trạng thái
    // cuối, nhất là khi trạng thái đó là `failed`.
    if (isSettled(entry)) return;
    entry.stage = stage;
    entry.source = source ?? null;
    entry.updatedAt = Date.now();
  };
  try {
    await entry.worker(report);
    entry.stage = 'ready';
    entry.source = null;
    entry.finish();
  } catch (error) {
    entry.stage = 'failed';
    entry.failure = error;
    entry.fail(error);
  } finally {
    entry.updatedAt = Date.now();
    entry.settledAt = Date.now();
    running -= 1;
    pump();
  }
}

/**
 * Xin một job cho `slug`. Đang có job chạy thì trả lại chính nó — đây là chỗ gộp
 * các lần poll và các tab trùng nhau thành một. Job cũ đã xong thì bỏ đi và mở
 * job mới: "nhập lại" phải thật sự nhập lại.
 */
export function startImport(slug: string, worker: Worker): ImportJob {
  const current = entries.get(slug);
  if (current && !isSettled(current)) return snapshot(current);
  prune();
  const now = Date.now();
  let finish: () => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const done = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  // Job có thể đổ mà không ai đợi (web chỉ poll trạng thái, không await): giữ một
  // nhánh catch trống để Node khỏi coi đó là unhandled rejection và giết tiến trình.
  void done.catch(() => {});
  const entry: Entry = {
    slug, stage: 'queued', source: null, startedAt: now, updatedAt: now,
    settledAt: null, failure: null, worker, done, finish, fail
  };
  entries.set(slug, entry);
  queue.push(slug);
  pump();
  return snapshot(entry);
}

/** Trạng thái job, hoặc null nếu chưa từng có / đã bị dọn. */
export function importJob(slug: string): ImportJob | null {
  const entry = entries.get(slug);
  return entry ? snapshot(entry) : null;
}

/**
 * Chờ job xong rồi ném lại đúng lỗi gốc, để `?wait=1` giữ nguyên mã lỗi (404 phim
 * không tồn tại khác 502 nguồn chết). Không có job thì coi như đã xong.
 */
export async function waitForImport(slug: string): Promise<void> {
  const entry = entries.get(slug);
  if (!entry) return;
  await entry.done;
}

/**
 * Bỏ job khỏi registry. Dùng sau khi đã trả lỗi cho client: giữ lại một job
 * `failed` thì lần bấm "Thử lại" nào cũng nhận lại đúng lỗi cũ, không nhập lại.
 */
export function forgetImport(slug: string) {
  const entry = entries.get(slug);
  if (entry && !isSettled(entry)) return;
  entries.delete(slug);
}

/** Số job đang chạy hoặc đang chờ — cho `/api/health` và test. */
export function importQueueSize() {
  return { running, queued: queue.length, tracked: entries.size };
}

/** Chỉ dùng trong test: registry là state ở module. */
export function resetImports() {
  entries.clear();
  queue.length = 0;
  running = 0;
}
