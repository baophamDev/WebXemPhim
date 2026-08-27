import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useGetContinueQuery, useGetFavoritesQuery } from '../api';
import { EmptyState, MovieCard, RailLabel, Shell, SkeletonGrid, SyncStatus } from '../ui';

export default function LibraryPage() {
  const favorites = useGetFavoritesQuery();
  const watching = useGetContinueQuery();

  return <Shell>
    <div className="page-container page-top">
      <div className="page-title">
        <div>
          <RailLabel prefix="CỦA TÔI">Trên thiết bị này</RailLabel>
          <h1>Thư viện</h1>
          <p>Phim đã lưu và đang xem dở</p>
        </div>
        <SyncStatus />
      </div>

      <section className="library-section">
        <div className="section-heading"><div><RailLabel prefix="MỤC">Xem tiếp</RailLabel><h2>Đang xem</h2></div></div>
        {watching.data?.items.length
          ? <div className="continue-grid">
              {watching.data.items.map((item) => <Link key={item.episode_id} to={`/watch/${item.slug}/${item.episode_id}`}>
                <img src={item.thumbUrl || '/poster-placeholder.svg'} alt="" loading="lazy" decoding="async" />
                <div><Play fill="currentColor" /><span><b>{item.name}</b><small>Tập {item.episodeName}</small></span></div>
              </Link>)}
            </div>
          : <EmptyState title="Chưa xem phim nào" message="Phim bạn mở sẽ hiện ở đây để xem tiếp." />}
      </section>

      <section className="library-section">
        <div className="section-heading"><div><RailLabel prefix="MỤC">Bộ sưu tập</RailLabel><h2>Phim đã lưu</h2></div></div>
        {favorites.isLoading ? <SkeletonGrid count={6} />
          : favorites.data?.items.length
            ? <div className="movie-grid">{favorites.data.items.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
            : <EmptyState title="Chưa lưu phim nào" message="Bấm “Lưu phim” ở trang chi tiết để thêm vào đây." />}
      </section>
    </div>
  </Shell>;
}
