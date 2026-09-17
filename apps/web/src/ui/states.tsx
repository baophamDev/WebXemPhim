/** Trạng thái chờ / rỗng / lỗi. */
import { Film, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react';

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
