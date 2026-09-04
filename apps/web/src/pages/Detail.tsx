import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Heart, Play, RefreshCw, Users } from 'lucide-react';
import { useGetFavoriteQuery, useGetMovieQuery, useImportMovieMutation, useSetFavoriteMutation } from '../api';
import { preloadPlayer } from '../chunks';
import { previewFromState, recallMovie, rememberMovie } from '../preview';
import type { CastMember, Episode, Movie } from '../types';
import { Breadcrumb, clean, EmptyState, ErrorState, image, ImportPanel, RailLabel, Shell, Spec, useImportProgress } from '../ui';

function FavoriteButton({ movieId }: { movieId: number }) {
  const favorite = useGetFavoriteQuery(movieId);
  const [setFavorite, { isLoading }] = useSetFavoriteMutation();
  const active = Boolean(favorite.data?.favorite);
  return <button disabled={isLoading} className={active ? 'button ghost active' : 'button ghost'} onClick={() => setFavorite({ movieId, enabled: !active })}>
    <Heart fill={active ? 'currentColor' : 'none'} />{active ? 'Đã lưu' : 'Lưu phim'}
  </button>;
}

function ImportButton({ slug }: { slug: string }) {
  const [run, { isLoading, isSuccess, isError }] = useImportMovieMutation();
  return <button className="button ghost" disabled={isLoading} onClick={() => run(slug)} title="Tải lại thông tin và nguồn phát">
    <RefreshCw className={isLoading ? 'spin' : ''} />
    {isLoading ? 'Đang tải' : isSuccess ? 'Đã làm mới' : isError ? 'Thử lại' : 'Làm mới nguồn'}
  </button>;
}

function EpisodeList({ movie }: { movie: Movie }) {
  const groups = useMemo(() => Object.entries((movie.episodes ?? []).reduce<Record<string, Episode[]>>((all, episode) => {
    (all[episode.serverName] ??= []).push(episode);
    return all;
  }, {})), [movie.episodes]);
  return <section className="episodes">
    <div className="section-heading">
      <div><RailLabel prefix="NGUỒN PHÁT">{movie.episodes?.length ?? 0} tập</RailLabel><h2>{movie.type === 'series' ? 'Danh sách tập' : 'Phát phim'}</h2></div>
    </div>
    {groups.length ? groups.map(([server, episodes]) => <div className="server-group" key={server}>
      <h3>{server.trim()}</h3>
      <div className="episode-grid">
        {/* pointerdown kéo trước chunk trang xem + hls.js: cú bấm vào một tập là
            lúc chắc chắn nhất rằng trình phát sắp cần đến, mà nó vẫn đến trước
            khi router đổi trang. */}
        {episodes.map((episode) => <Link key={episode.id} to={`/watch/${movie.slug}/${episode.id}`} state={{ preview: movie }} onPointerDown={preloadPlayer}><Play />{episode.name}</Link>)}
      </div>
    </div>) : <EmptyState title="Chưa có nguồn phát" message="Bấm “Làm mới nguồn” để tải lại từ nguồn phim." />}
  </section>;
}

/** Diễn viên có slug thì bấm được sang trang người; không có thì hiện chữ thường. */
function CastLinks({ cast, names, kind }: { cast: CastMember[]; names: string[]; kind: 'actor' | 'director' }) {
  const linked = cast.filter((member) => member.kind === kind);
  if (linked.length) {
    return <>{linked.map((member, index) => <span key={member.slug}>{index > 0 ? ', ' : ''}<Link to={`/person/${member.slug}`}>{member.name}</Link></span>)}</>;
  }
  return <>{names.join(', ') || 'Đang cập nhật'}</>;
}

/**
 * Khung xương cho lúc chưa có cả bản mô tả (mở thẳng URL, hoặc F5 giữa trang).
 * Vẫn dựng đúng hình khối của trang chi tiết thay vì một vòng xoay giữa màn hình:
 * người xem thấy trang đang hình thành thì chờ được, thấy vòng xoay thì tưởng treo.
 */
function DetailSkeleton() {
  return <section className="detail-hero skeleton" aria-hidden="true">
    <div className="hero-veil" />
    <div className="detail-inner">
      <div className="detail-copy">
        <span className="bone label" />
        <span className="bone title" />
        <span className="bone line" />
        <span className="bone line short" />
      </div>
    </div>
  </section>;
}

export default function Detail() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const pathname = location.pathname;
  const result = useGetMovieQuery(slug);
  const fetched = result.data?.movie ?? null;
  /**
   * API trả 202 (`movie: null` kèm `importing`) khi phim chưa có trong kho: nó đã
   * mở job nhập ở nền và không chặn request. Đó là tín hiệu để poll tiến trình.
   */
  const active = Boolean(result.data && !fetched);
  const progress = useImportProgress(slug, active);
  /**
   * Bản mô tả của thẻ phim vừa bấm — có poster, tên, năm, điểm. Đủ để vẽ nửa trên
   * của trang ngay khi điều hướng, trong lúc API còn đang kéo danh sách tập về.
   */
  const preview = useMemo(() => previewFromState(location.state) ?? recallMovie(slug), [location.state, slug]);
  const movie: Movie | null = fetched ?? preview;
  const failed = result.isError || Boolean(progress.failure);
  // Nhớ bản đầy đủ: quay lại trang này (back/forward) là có ngay, không chờ mạng.
  useEffect(() => { rememberMovie(fetched); }, [fetched]);

  if (!movie) {
    if (failed) {
      return <Shell><div className="page-container page-top">
        <ErrorState onRetry={() => { progress.retry(); result.refetch(); }} message={progress.failure || 'Không mở được phim này.'} />
      </div></Shell>;
    }
    return <Shell flush>
      <DetailSkeleton />
      {active ? <div className="page-container detail-content"><ImportPanel progress={progress} onRetry={() => { progress.retry(); result.refetch(); }} /></div> : null}
    </Shell>;
  }

  const cast = movie.cast ?? [];
  const actors = cast.filter((member) => member.kind === 'actor');
  const first = movie.episodes?.[0];
  /** Chưa có bản trong kho: phần dưới trang là tiến trình tải, không phải "chưa có tập". */
  const loading = !fetched;

  return <Shell flush>
    <section className="detail-hero">
      <img className="detail-media" src={image(movie, true) || '/poster-placeholder.svg'} alt="" fetchPriority="high" decoding="async" />
      <div className="hero-veil" />
      <div className="detail-inner">
        <Breadcrumb items={[['Trang chủ', '/'], ['Khám phá', '/browse/list/phim-moi-cap-nhat'], [movie.name, '']]} />
        <div className="detail-copy">
          <RailLabel prefix="PHIM">{movie.type === 'series' ? 'Phim bộ' : 'Phim lẻ'}</RailLabel>
          <h1 className="hero-title detail">{movie.name}</h1>
          <p className="origin-name">{movie.originName}</p>
          <Spec movie={movie} />
          <p className="description">{clean(movie.description) || 'Chưa có mô tả.'}</p>
          <div className="actions">
            {first
              ? <Link className="button primary" to={`/watch/${movie.slug}/${first.id}`} state={{ preview: movie }} onPointerDown={preloadPlayer}><Play fill="currentColor" />Xem ngay</Link>
              : <button className="button primary" disabled><Play />{loading ? 'Đang tải nguồn phát' : 'Chưa có tập'}</button>}
            {/* Lưu phim cần id trong kho — bản mô tả từ thẻ phim chưa có id. */}
            {fetched ? <FavoriteButton movieId={fetched.id} /> : null}
            {pathname.startsWith('/movie/') && !loading ? <ImportButton slug={slug} /> : null}
          </div>
        </div>
      </div>
    </section>
    <div className="page-container detail-content">
      {loading
        ? <ImportPanel progress={progress} onRetry={() => { progress.retry(); result.refetch(); }} />
        : <EpisodeList movie={movie} />}
      <section className="detail-info">
        <div>
          <RailLabel prefix="THÔNG TIN">Chi tiết</RailLabel>
          <h2>Chi tiết</h2>
          <p className="info-row"><b>Thể loại</b><span>{movie.genres.join(', ') || 'Đang cập nhật'}</span></p>
          <p className="info-row"><b>Quốc gia</b><span>{movie.countries.join(', ') || 'Đang cập nhật'}</span></p>
          <p className="info-row"><b>Đạo diễn</b><span><CastLinks cast={cast} names={movie.directors} kind="director" /></span></p>
          <p className="info-row"><b>Ngôn ngữ</b><span>{movie.language || 'Đang cập nhật'}</span></p>
        </div>
        <div>
          <RailLabel prefix="DÀN CAST">{actors.length || movie.actors.length} người</RailLabel>
          <h2>Diễn viên</h2>
          {actors.length
            ? <div className="chip-row">{actors.slice(0, 18).map((member) => <Link className="chip" key={member.slug} to={`/person/${member.slug}`}><Users />{member.name}</Link>)}</div>
            : <p>{movie.actors.slice(0, 18).join(', ') || 'Đang cập nhật'}</p>}
        </div>
      </section>
    </div>
  </Shell>;
}
