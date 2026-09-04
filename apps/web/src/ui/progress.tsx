/**
 * Tiến trình "tải phim" và thanh tiến trình chung trên đỉnh trang.
 *
 * Vì sao cần: mở một phim chưa từng xem thì API phải đi qua nhiều nguồn ngoài, mỗi
 * nguồn có thể mất vài giây. Trước đây web đứng im trong lúc đó — người dùng bấm
 * vào poster rồi ngồi nhìn một vòng xoay, không biết web còn sống hay không. Giờ
 * việc kéo dữ liệu chạy ở nền và chỗ này kể lại nó đang làm gì.
 *
 * Các chặng hiện ra là chặng **thật** của resolver ở API (hỏi nguồn phát → hỏi
 * nguồn thông tin → khớp phim giữa các nguồn → bồi metadata → lưu), không phải một
 * con số phần trăm bịa ra cho đẹp. Một người chờ 15 giây mà đọc được "đang hỏi
 * tvdb" thì biết web đang làm việc; một thanh chạy giả thì lần sau họ không tin nữa.
 */
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react';
import { cinemaApi, useGetImportStatusQuery } from '../api';
import type { ImportJob, ImportStage } from '../types';

const POLL_MS = 1_500;

/** Nhãn tiếng Việt cho từng chặng, viết theo việc đang làm chứ không theo tên hàm. */
const STAGE_LABEL: Record<ImportStage, string> = {
  queued: 'Đang xếp hàng',
  playable: 'Đang hỏi nguồn phát',
  metadata: 'Đang hỏi nguồn thông tin',
  rematch: 'Đang khớp phim giữa các nguồn',
  enrich: 'Đang bồi thêm thông tin',
  saving: 'Đang lưu vào kho',
  ready: 'Đã xong',
  failed: 'Không tải được'
};

/**
 * Phần trăm cho từng chặng. Không phải tiến độ đo được — không ai biết trước một
 * nguồn mất bao lâu — mà là *thứ tự* các chặng quy ra khoảng cách nhìn thấy được.
 * Chặng cuối dừng ở 90 để thanh không đầy trước khi việc xong thật.
 */
const STAGE_PERCENT: Record<ImportStage, number> = {
  queued: 6, playable: 26, metadata: 44, rematch: 60, enrich: 76, saving: 90, ready: 100, failed: 100
};

const ORDER: ImportStage[] = ['queued', 'playable', 'metadata', 'rematch', 'enrich', 'saving'];

export interface ImportProgress {
  job: ImportJob | null;
  /** Lý do đổ, giữ lại cả khi API đã quên job — xem ghi chú trong `useImportProgress`. */
  failure: string | null;
  retry: () => void;
}

/**
 * Theo dõi một lần nhập phim.
 *
 * `active` là "phim này chưa có trong kho và API nói đang nhập". Chỉ poll khi đó:
 * poll khi không có gì chạy là mỗi 1.5 giây một request rỗng cho mọi tab đang mở.
 *
 * Job đổ thì API **quên** job ngay sau khi trả về (để lần thử lại là một lần nhập
 * thật, không phát lại lỗi cũ), nên lần poll kế tiếp sẽ thấy `null`. Vì vậy lỗi
 * phải được giữ lại ở đây; nếu không thì thông báo lỗi nhấp nháy một cái rồi biến
 * mất, để lại một trang trống không giải thích gì.
 */
export function useImportProgress(slug: string, active: boolean): ImportProgress {
  const dispatch = useDispatch();
  const [failure, setFailure] = useState<string | null>(null);
  /** Khoá của lần nhập đã xử lý xong, để không gọi lại phim vô hạn. */
  const handled = useRef<string | null>(null);
  const query = useGetImportStatusQuery(slug, { skip: !active, pollingInterval: active ? POLL_MS : 0 });
  const job = query.data?.importing ?? null;

  useEffect(() => { handled.current = null; setFailure(null); }, [slug]);

  useEffect(() => {
    if (!active || !query.data) return;
    // Khoá theo `startedAt`: một lần nhập mới (bấm "Thử lại") có mốc khác nên được
    // xử lý lại, còn cùng một lần nhập thì chỉ chốt một lần.
    const key = `${slug}|${job?.startedAt ?? 'none'}`;
    if (handled.current === key) return;
    if (job && job.stage !== 'ready' && job.stage !== 'failed') return;
    handled.current = key;
    if (job?.stage === 'failed') { setFailure(job.error || 'Không tải được phim này từ nguồn nào.'); return; }
    // Xong, hoặc job đã bị dọn: dữ liệu nằm ở DB rồi, đọc lại phim một lần.
    dispatch(cinemaApi.util.invalidateTags([{ type: 'Movie', id: slug }, { type: 'Movie', id: `local-${slug}` }]));
  }, [active, query.data, job, dispatch, slug]);

  const retry = () => {
    handled.current = null;
    setFailure(null);
    dispatch(cinemaApi.util.invalidateTags([{ type: 'Movie', id: slug }, { type: 'Movie', id: `local-${slug}` }]));
  };

  return { job, failure, retry };
}

/**
 * Số giây đã chờ, đếm tại chỗ.
 *
 * Không lấy thẳng `elapsedMs` của mỗi lần poll: nó chỉ đổi 1.5 giây một lần nên số
 * giây nhảy 2 → 4 → 5, trông như treo. Cũng không tính từ `startedAt` của server —
 * đồng hồ hai máy lệch nhau thì ra số âm. Nên: lấy mốc từ server một lần rồi tự
 * cộng thời gian trôi ở client.
 */
function useElapsed(job: ImportJob | null): number {
  const anchor = useRef({ ms: 0, at: Date.now(), key: '' });
  const [, tick] = useState(0);
  const key = job ? `${job.slug}|${job.startedAt}` : '';
  if (job && anchor.current.key !== key) anchor.current = { ms: job.elapsedMs, at: Date.now(), key };
  useEffect(() => {
    if (!job) return;
    const timer = window.setInterval(() => tick((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [job]);
  if (!job) return 0;
  return Math.max(0, Math.round((anchor.current.ms + (Date.now() - anchor.current.at)) / 1_000));
}

/**
 * Bảng tiến trình tải phim. Ba thứ, theo đúng thứ tự người chờ muốn biết: đang làm
 * gì, đi được bao xa, và chờ bao lâu rồi.
 *
 * Thanh chỉ tiến, không lùi: chặng của resolver không tuyến tính tuyệt đối (có
 * đường quay lại hỏi nguồn phát bằng tên phim), mà một thanh tiến trình tụt về sau
 * thì người xem hiểu là web đang lỗi.
 */
export function ImportPanel({ progress, onRetry }: { progress: ImportProgress; onRetry?: () => void }) {
  const { job, failure } = progress;
  const seconds = useElapsed(job);
  const peak = useRef(0);
  const stage: ImportStage = failure ? 'failed' : job?.stage ?? 'queued';
  const target = STAGE_PERCENT[stage];
  if (stage === 'queued') peak.current = 0;
  peak.current = Math.max(peak.current, target);
  const percent = peak.current;
  const reached = ORDER.indexOf(stage);

  if (failure) {
    return <section className="import-panel failed" role="alert">
      <header><TriangleAlert /><b>Không tải được phim</b></header>
      <p className="import-reason">{failure}</p>
      <button type="button" className="button ghost" onClick={() => { peak.current = 0; (onRetry ?? progress.retry)(); }}>
        <RotateCw /> Thử lại
      </button>
    </section>;
  }

  return <section className="import-panel" aria-live="polite">
    <header>
      <LoaderCircle className="spin" />
      <b>Đang tải phim</b>
      {job?.source ? <span className="import-source">nguồn {job.source}</span> : null}
      <small>{seconds}s</small>
    </header>
    {/* aria-*: người dùng đọc màn hình nghe được tiến trình, không chỉ thấy thanh màu. */}
    <div
      className="import-bar" role="progressbar"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={STAGE_LABEL[stage]}
    >
      <i style={{ width: `${percent}%` }} />
    </div>
    <p className="import-stage">
      <span>{STAGE_LABEL[stage]}</span>
      <span className="import-ticks" aria-hidden="true">
        {ORDER.map((entry, index) => <i key={entry} className={index <= reached ? 'on' : ''} />)}
      </span>
    </p>
  </section>;
}

/**
 * Thanh mảnh trên đỉnh trang, sáng khi còn request nào đang bay.
 *
 * Đây là phần "web có động tĩnh" cho mọi thao tác, không riêng việc mở phim: đổi
 * trang, tìm kiếm, lật trang danh sách. Đếm số query đang chạy trong RTK Query —
 * selector trả về một con số nên chỉ render lại khi số đó đổi, không phải mỗi
 * action.
 */
export function TopProgress() {
  const pending = useSelector((state: { cinemaApi?: { queries?: Record<string, { status?: string } | undefined>; mutations?: Record<string, { status?: string } | undefined> } }) => {
    let count = 0;
    for (const entry of Object.values(state.cinemaApi?.queries ?? {})) if (entry?.status === 'pending') count += 1;
    for (const entry of Object.values(state.cinemaApi?.mutations ?? {})) if (entry?.status === 'pending') count += 1;
    return count;
  });
  /**
   * Giữ thanh lại thêm một nhịp sau khi hết request: request cực nhanh (cache hit
   * kèm một lần refetch) làm thanh nháy một cái rồi tắt, trông như lỗi màn hình.
   */
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (pending > 0) { setVisible(true); return; }
    const timer = window.setTimeout(() => setVisible(false), 260);
    return () => window.clearTimeout(timer);
  }, [pending]);
  return <div className={`top-progress${visible ? ' on' : ''}`} aria-hidden="true"><i /></div>;
}
