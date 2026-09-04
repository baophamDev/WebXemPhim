/**
 * Cửa vào duy nhất cho các mảnh giao diện dùng chung. Mỗi trang nằm ở src/pages/
 * và được nạp lười, nên phần chia sẻ phải đi qua một module để Vite gom vào một
 * chunk chung thay vì nhân bản vào từng trang.
 *
 * Trước đây tất cả nằm trong một file ui.tsx dài; giờ tách theo vai trò, còn đây
 * là lớp tập hợp lại nên các trang không phải sửa đường import.
 */
export { clean, humanize, image, listLabels, stillMotion } from './format';
export { useDebounced } from './hooks';
export { Logo, Shell } from './Shell';
export { MovieCard, RailLabel, Spec } from './cards';
export { MovieRow } from './Rail';
export { EmptyState, ErrorState, RouteFallback, SkeletonGrid, SyncStatus } from './states';
export { BackToTop, Breadcrumb, Pagination } from './nav';
