import { Link } from 'react-router-dom';
import { Check, Play } from 'lucide-react';
import { useGetContinueQuery, useGetFavoritesQuery } from '../api';
import { continueItems, episodeLabel, mergeFavorites, progressPercent, type ContinueItem } from '../library';
import { useLibrary } from '../libraryStore';
import { EmptyState, MovieCard, RailLabel, Shell, SkeletonGrid } from '../ui';

/**
 * Một thẻ của dải "Xem tiếp"/"Đã xem": **một phim**, kèm tập mới nhất.
 *
 * Gộp theo phim là chủ ý: tiến trình được ghi theo tập, nên một series 10 tập sẽ
 * nằm 10 dòng nếu hiện thẳng ra — nhìn như danh sách tập chứ không phải thư viện.
 */
function ContinueCard({ item, done = false }: { item: ContinueItem; done?: boolean }) {
  const percent = progressPercent(item);
  const label = episodeLabel(item.episodeName) || 'Tập mới nhất';
  return <Link
    to={`/watch/${item.slug}/${item.episodeId}`}
    state={item.movie ? { preview: item.movie } : undefined}
    aria-label={`${done ? 'Xem lại' : 'Xem tiếp'} ${item.name} — ${label}`}
  >
    <img src={item.thumbUrl || '/poster-placeholder.svg'} alt="" loading="lazy" decoding="async" />
    <div>
      {done ? <Check /> : <Play fill="currentColor" />}
      <span><b>{item.name}</b><small>{label}</small></span>
    </div>
    {percent > 0 && !done ? <i className="continue-track" aria-hidden="true"><i style={{ width: `${percent}%` }} /></i> : null}
  </Link>;
}

export default function LibraryPage() {
  // Hai nguồn: bản ghi trên máy (luôn có) và bản ghi trong kho (khi API sống).
  const local = useLibrary();
  const remoteFavorites = useGetFavoritesQuery();
  const remoteWatching = useGetContinueQuery();
  const { watching, watched } = continueItems(remoteWatching.data?.items, local.progress);
  const saved = mergeFavorites(remoteFavorites.data?.items, local.favorites);
  // Chỉ hiện khung xương khi chưa có gì để vẽ: bản trên máy đã có thì hiện luôn,
  // không bắt người xem chờ một API có thể đang chết.
  const loadingWatch = remoteWatching.isLoading && !watching.length && !watched.length;
  const loadingSaved = remoteFavorites.isLoading && !saved.length;

  return <Shell>
    <div className="page-container page-top">
      <div className="page-title">
        <div>
          <RailLabel prefix="CỦA TÔI">Trên thiết bị này</RailLabel>
          <h1>Thư viện</h1>
          <p>Phim đã lưu và đang xem dở</p>
        </div>
      </div>

      <section className="library-section">
        <div className="section-heading"><div><RailLabel prefix="MỤC">Xem tiếp</RailLabel><h2>Đang xem</h2></div></div>
        {loadingWatch ? <SkeletonGrid count={4} />
          : watching.length
            ? <div className="continue-grid">{watching.map((item) => <ContinueCard key={item.slug} item={item} />)}</div>
            : <EmptyState
                title={watched.length ? 'Không còn phim xem dở' : 'Chưa xem phim nào'}
                message={watched.length ? 'Các phim đã xem xong nằm ở mục “Đã xem” bên dưới.' : 'Phim bạn mở sẽ hiện ở đây để xem tiếp.'}
              />}
      </section>

      {watched.length ? <section className="library-section">
        <div className="section-heading"><div><RailLabel prefix="MỤC">Lịch sử</RailLabel><h2>Đã xem</h2></div></div>
        <div className="continue-grid">{watched.map((item) => <ContinueCard key={item.slug} item={item} done />)}</div>
      </section> : null}

      <section className="library-section">
        <div className="section-heading"><div><RailLabel prefix="MỤC">Bộ sưu tập</RailLabel><h2>Phim đã lưu</h2></div></div>
        {loadingSaved ? <SkeletonGrid count={6} />
          : saved.length
            ? <div className="movie-grid">{saved.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}</div>
            : <EmptyState title="Chưa lưu phim nào" message="Bấm “Lưu phim” ở trang chi tiết để thêm vào đây." />}
      </section>
    </div>
  </Shell>;
}
