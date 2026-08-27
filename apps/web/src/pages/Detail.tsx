import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Heart, LoaderCircle, Play, RefreshCw, Users } from 'lucide-react';
import { useGetFavoriteQuery, useGetMovieQuery, useImportMovieMutation, useSetFavoriteMutation } from '../api';
import type { CastMember, Episode, Movie } from '../types';
import { Breadcrumb, clean, EmptyState, ErrorState, image, RailLabel, Shell, Spec } from '../ui';

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
        {episodes.map((episode) => <Link key={episode.id} to={`/watch/${movie.slug}/${episode.id}`}><Play />{episode.name}</Link>)}
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

export default function Detail() {
  const { slug = '' } = useParams();
  const pathname = useLocation().pathname;
  const result = useGetMovieQuery(slug);
  if (result.isLoading) return <Shell><div className="full-loader"><LoaderCircle className="spin" /></div></Shell>;
  if (result.isError || !result.data?.movie) {
    return <Shell><div className="page-container page-top"><ErrorState onRetry={result.refetch} message="Không mở được phim này." /></div></Shell>;
  }
  const movie = result.data.movie;
  const cast = movie.cast ?? [];
  const actors = cast.filter((member) => member.kind === 'actor');
  const first = movie.episodes?.[0];

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
              ? <Link className="button primary" to={`/watch/${movie.slug}/${first.id}`}><Play fill="currentColor" />Xem ngay</Link>
              : <button className="button primary" disabled><Play />Chưa có tập</button>}
            <FavoriteButton movieId={movie.id} />
            {pathname.startsWith('/movie/') ? <ImportButton slug={slug} /> : null}
          </div>
        </div>
      </div>
    </section>
    <div className="page-container detail-content">
      <EpisodeList movie={movie} />
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
