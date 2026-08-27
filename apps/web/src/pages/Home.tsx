import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info, Play } from 'lucide-react';
import { useGetCatalogQuery } from '../api';
import { clean, ErrorState, image, MovieRow, RailLabel, Shell, SkeletonGrid, Spec, SyncStatus } from '../ui';

export default function Home() {
  const home = useGetCatalogQuery({ kind: 'home', page: 1, limit: 24 });
  const series = useGetCatalogQuery({ kind: 'list', value: 'phim-bo', page: 1, limit: 12 });
  const movies = useGetCatalogQuery({ kind: 'list', value: 'phim-le', page: 1, limit: 12 });
  const ultra = useGetCatalogQuery({ kind: 'list', value: '4k', page: 1, limit: 12 });
  const featured = home.data?.items[0];
  const top = useMemo(() => [...(home.data?.items ?? [])].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10), [home.data]);

  if (home.isError && !featured) {
    return <Shell><div className="page-container page-top"><ErrorState onRetry={home.refetch} /></div></Shell>;
  }
  return <Shell flush>
    {featured
      ? <section className="hero">
          {/* fetchPriority + không lazy: đây là ảnh LCP của trang chủ. */}
          <img className="hero-media" src={image(featured, true) || '/poster-placeholder.svg'} alt="" fetchPriority="high" decoding="async" />
          <div className="hero-veil" />
          <div className="hero-copy">
            <RailLabel prefix="ĐANG NỔI">Mới về kho</RailLabel>
            <h1 className="hero-title chrome-text" data-ghost={featured.name}><span>{featured.name}</span></h1>
            <p className="origin-name">{featured.originName}</p>
            <Spec movie={featured} />
            <p className="description">{clean(featured.description) || `Xem ${featured.name} ngay trên kho phim của gia đình.`}</p>
            <div className="actions">
              <Link className="button primary" to={`/movie/${featured.slug}`}><Play fill="currentColor" />Xem ngay</Link>
              <Link className="button ghost" to={`/movie/${featured.slug}`}><Info />Chi tiết</Link>
            </div>
          </div>
        </section>
      : <div className="hero-skeleton" />}
    <div className="page-container page-top">
      <SyncStatus />
      {home.isLoading
        ? <SkeletonGrid />
        : <MovieRow label="Mới cập nhật" title="Vừa thêm vào kho" items={home.data?.items ?? []} to="/browse/list/phim-moi-cap-nhat" />}
      <MovieRow label="Điểm cao" title="Đáng xem nhất" items={top} to="/browse/list/phim-moi-cap-nhat?sort=rating" ranked />
      <MovieRow label="Phim bộ" title="Xem dài hơi" items={series.data?.items ?? []} to="/browse/list/phim-bo" />
      <MovieRow label="Phim lẻ" title="Xem một buổi" items={movies.data?.items ?? []} to="/browse/list/phim-le" />
      <MovieRow label="Chất lượng" title="Bản 4K" items={ultra.data?.items ?? []} to="/browse/list/4k" />
    </div>
  </Shell>;
}
