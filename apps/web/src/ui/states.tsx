/** Trạng thái chờ / rỗng / lỗi, và thẻ trạng thái đồng bộ kho phim. */
import { useEffect, useState } from 'react';
import { Film, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react';
import { apiOfflineHint, useGetHealthQuery, useGetSyncQuery, useStartSyncMutation } from '../api';

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return <div className="movie-grid">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}><i /><b /><span /></div>)}</div>;
}

export function RouteFallback() {
  return <div className="route-fallback"><LoaderCircle className="spin" /></div>;
}

export function ErrorState({ onRetry, message = 'Không tải được dữ liệu.' }: { onRetry?: () => void; message?: string }) {
  return <div className="state-panel">
    <WifiOff /><h2>Mất kết nối</h2><p>{message}</p>
    {onRetry ? <button className="button ghost" onClick={onRetry}><RefreshCw />Thử lại</button> : null}
  </div>;
}

export function EmptyState({ title = 'Chưa có nội dung', message = 'Đổi bộ lọc hoặc quay lại sau.' }: { title?: string; message?: string }) {
  return <div className="state-panel"><Film /><h2>{title}</h2><p>{message}</p></div>;
}

/**
 * Trạng thái đồng bộ. Chỉ hỏi lại server khi thật sự có việc đang chạy:
 * trước đây poll 3 giây/lần suốt phiên làm việc, tốn pin và giữ tab luôn "bận".
 */
export function SyncStatus() {
  const health = useGetHealthQuery(undefined, { pollingInterval: 60000 });
  const [live, setLive] = useState(false);
  const { data } = useGetSyncQuery(undefined, { pollingInterval: live ? 3000 : 0, skip: health.isError });
  const working = data?.status === 'running';
  useEffect(() => setLive(working), [working]);
  const [start, { isLoading }] = useStartSyncMutation();
  const offline = health.isError;
  const run = async () => { await start({ pages: 3 }); setLive(true); };
  return <div className={offline ? 'sync-status offline' : 'sync-status'}>
    <span className="sync-icon">{offline ? <WifiOff /> : <RefreshCw className={working ? 'spin' : ''} />}</span>
    <div>
      <b>{offline ? 'API ngoại tuyến' : working ? 'Đang cập nhật kho phim' : 'Kho phim đã lưu'}</b>
      <small>{offline ? apiOfflineHint() : working ? `${data?.processed ?? 0} phim · trang ${data?.page ?? 0}/${data?.totalPages ?? '?'}` : `${data?.processed ?? 0} phim đã đồng bộ`}</small>
    </div>
    <button disabled={offline || working || isLoading} onClick={run}>{working ? 'Đang chạy' : 'Đồng bộ'}</button>
  </div>;
}
