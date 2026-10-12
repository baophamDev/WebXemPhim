import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Heart, Play, Users } from 'lucide-react';
import { useGetFavoriteQuery, useSetFavoriteMutation } from '../api';
import { preloadPlayer } from '../chunks';
import { removeFavorite, saveFavorite, useLibrary } from '../libraryStore';
import { previewFromState, recallMovie, rememberMovie } from '../preview';
import { useSourceDetail } from '../useSourceDetail';
import type { SourceId } from '../sources';
import type { TitleHint } from '../match';
import type { CastMember, Episode, Movie } from '../types';
import { Breadcrumb, clean, EmptyState, ErrorState, image, RailLabel, Shell, Spec } from '../ui';
import { useHeroEntrance } from '../ui/motion';

/**
 * Nút lưu phim ghi vào thư viện trên máy (localStorage). Không còn backend nên phim
 * nguồn có `id: 0` → chỉ còn nhánh local; giữ nhánh kho để nếu sau nối lại vẫn đúng.
 */
function FavoriteButton({ movie }: { movie: Movie }) {
  const inStore = movie.id > 0;
  const favorite = useGetFavoriteQuery(movie.id, { skip: !inStore });
  const [setFavorite, { isLoading }] = useSetFavoriteMutation();
  const local = useLibrary();
  const active = Boolean(favorite.data?.favorite) || local.favorites.some((entry) => entry.movie.slug === movie.slug);
  const toggle = () => {
    if (active) removeFavorite(movie.slug); else saveFavorite(movie);
    if (inStore) setFavorite({ movieId: movie.id, enabled: !active });
  };
  return <button disabled={isLoading} className={active ? 'button ghost active' : 'button ghost'} onClick={toggle}>
    <Heart fill={active ? 'currentColor' : 'none'} />{active ? 'Đã lưu' : 'Lưu phim'}
  </button>;
}

/** Link tập mang theo `source` để trang Xem mở đúng nguồn đã dựng danh sách này. */
function EpisodeList({ movie, sourceId }: { movie: Movie; sourceId: SourceId | null }) {
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
        {/* pointerdown kéo trước chunk trang xem + hls.js trước khi router đổi trang. */}
        {episodes.map((episode) => <Link key={episode.id} to={`/watch/${movie.slug}/${episode.id}`} state={{ preview: movie, source: sourceId ?? undefined }} onPointerDown={preloadPlayer}><Play />{episode.name}</Link>)}
      </div>
    </div>) : <EmptyState title="Chưa có nguồn phát" message="Thử mở trang xem rồi đổi nguồn, hoặc chọn phim khác." />}
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

/** Khung xương cho lúc chưa có cả bản mô tả (mở thẳng URL, hoặc F5 giữa trang). */
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

/**
 * Chi tiết phim lấy thẳng từ nguồn (không còn backend). `useSourceDetail('auto')`
 * tự chọn nguồn phát được; danh sách tập và nút "Xem ngay" mang theo nguồn đó để
 * trang Xem mở đúng nguồn (và còn đổi nguồn bằng tay ở đó).
 */
export default function Detail() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const preview = useMemo(() => previewFromState(location.state) ?? recallMovie(slug), [location.state, slug]);
  const hint = useMemo<TitleHint>(() => ({
    name: preview?.name ?? '', originName: preview?.originName ?? null, year: preview?.year ?? null, slug
  }), [preview?.name, preview?.originName, preview?.year, slug]);
  const detail = useSourceDetail(slug, hint, 'auto');
  const movie: Movie | null = detail.data?.movie ?? preview ?? null;
  // Hook entrance phải đứng trước mọi `return` có điều kiện (luật hooks).
  const scope = useHeroEntrance<HTMLElement>([slug]);
  // Nhớ bản đầy đủ: quay lại trang này (back/forward) là có ngay, không chờ mạng.
  useEffect(() => { if (detail.data?.movie) rememberMovie(detail.data.movie); }, [detail.data]);

  if (!movie) {
    if (detail.error) {
      return <Shell><div className="page-container page-top">
        <ErrorState message={detail.error} />
      </div></Shell>;
    }
    return <Shell flush><DetailSkeleton /></Shell>;
  }

  const cast = movie.cast ?? [];
  const actors = cast.filter((member) => member.kind === 'actor');
  const first = movie.episodes?.[0];
  const loading = detail.isFetching && !movie.episodes?.length;

  return <Shell flush>
    <section className="detail-hero" ref={scope}>
      <img data-motion="media" className="detail-media" src={image(movie, true) || '/poster-placeholder.svg'} alt="" fetchPriority="high" decoding="async" />
      <div className="hero-veil" />
      <div className="detail-inner">
        <Breadcrumb items={[['Trang chủ', '/'], ['Khám phá', '/browse/list/phim-moi-cap-nhat'], [movie.name, '']]} />
        <div className="detail-copy" data-motion="copy">
          <RailLabel prefix="PHIM">{movie.type === 'series' ? 'Phim bộ' : 'Phim lẻ'}</RailLabel>
          <h1 className="hero-title detail">{movie.name}</h1>
          <p className="origin-name">{movie.originName}</p>
          <Spec movie={movie} />
          <p className="description">{clean(movie.description) || 'Chưa có mô tả.'}</p>
          <div className="actions">
            {first
              ? <Link className="button primary" to={`/watch/${movie.slug}/${first.id}`} state={{ preview: movie, source: detail.sourceId ?? undefined }} onPointerDown={preloadPlayer}><Play fill="currentColor" />Xem ngay</Link>
              : <button className="button primary" disabled><Play />{loading ? 'Đang tải nguồn phát' : 'Chưa có tập'}</button>}
            <FavoriteButton movie={movie} />
          </div>
        </div>
      </div>
    </section>
    <div className="page-container detail-content">
      {loading
        ? <section className="episodes"><EmptyState title="Đang tải nguồn phát" message="Đang hỏi các nguồn phim…" /></section>
        : <EpisodeList movie={movie} sourceId={detail.sourceId} />}
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

