import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { loadDetail, loadWatch } from './chunks';
import { RouteFallback, TopProgress } from './ui';

/**
 * Mỗi trang là một chunk riêng: mở trang chủ không phải tải kèm trình phát,
 * và hls.js chỉ về máy khi người xem thật sự bấm vào một tập.
 *
 * Chi tiết và Xem lấy hàm nạp từ `chunks.ts` chứ không tự viết `import()`: hai
 * chunk đó còn được hâm nóng từ lúc `pointerdown` ở chỗ khác, và cả hai nơi phải
 * dùng chung một specifier mới ra chung một chunk.
 */
const Home = lazy(() => import('./pages/Home'));
const Browse = lazy(() => import('./pages/Browse'));
const SearchPage = lazy(() => import('./pages/Search'));
const Detail = lazy(loadDetail);
const Watch = lazy(loadWatch);
const Library = lazy(() => import('./pages/Library'));
const Local = lazy(() => import('./pages/Local'));
const People = lazy(() => import('./pages/People'));
const Person = lazy(() => import('./pages/Person'));
const Showtimes = lazy(() => import('./pages/Showtimes'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return <>
    {/* Vạch tiến trình mảnh trên đỉnh trang. Đặt ngoài `Suspense` để lúc chunk của
        trang mới đang về nó vẫn còn sống — nằm trong thì fallback tháo nó ra đúng
        lúc cần nhất. */}
    <TopProgress />
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse/:kind/:value" element={<Browse />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/movie/:slug" element={<Detail />} />
        <Route path="/watch/:slug/:episodeId" element={<Watch />} />
        <Route path="/library" element={<Library />} />
        <Route path="/local" element={<Local />} />
        <Route path="/people" element={<People />} />
        <Route path="/person/:slug" element={<Person />} />
        <Route path="/showtimes" element={<Showtimes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </>;
}
