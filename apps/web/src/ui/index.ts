/**
 * Cửa vào duy nhất cho các mảnh giao diện dùng chung. Mỗi trang nằm ở src/pages/
 * và được nạp lười, nên phần chia sẻ phải đi qua một module để Vite gom vào một
 * chunk chung thay vì nhân bản vào từng trang.
 *
 * Trước đây tất cả nằm trong một file ui.tsx dài; giờ tách theo vai trò, còn đây
 * là lớp tập hợp lại nên các trang không phải sửa đường import.
 */
export { clean, humanize, image, listLabels, stillMotion } from './format';
export { useDebounced, useDropdown } from './hooks';
export { Logo, Shell, Header, SiteFooter, NavigationEffects } from './Shell';
export { MovieCard, RailLabel, Spec, useWarmDetail } from './cards';
export { EmptyState, ErrorState, RouteFallback, SkeletonGrid, SyncStatus } from './states';
export { BackToTop, Breadcrumb, Pagination } from './nav';
export { ImportPanel, TopProgress, useImportProgress, type ImportProgress } from './progress';
export { ThemePicker } from './pickers';
