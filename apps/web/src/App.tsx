import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RouteFallback } from './ui';

/**
 * Mỗi trang là một chunk riêng: mở trang chủ không phải tải kèm trình phát,
 * và hls.js chỉ về máy khi người xem thật sự bấm vào một tập.
 */
const Home = lazy(() => import('./pages/Home'));
const Browse = lazy(() => import('./pages/Browse'));
const SearchPage = lazy(() => import('./pages/Search'));
const Detail = lazy(() => import('./pages/Detail'));
const Watch = lazy(() => import('./pages/Watch'));
const Library = lazy(() => import('./pages/Library'));
const Local = lazy(() => import('./pages/Local'));
const People = lazy(() => import('./pages/People'));
const Person = lazy(() => import('./pages/Person'));
const Showtimes = lazy(() => import('./pages/Showtimes'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return <Suspense fallback={<RouteFallback />}>
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
  </Suspense>;
}
