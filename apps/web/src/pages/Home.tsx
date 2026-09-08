import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Film, Play, Star } from 'lucide-react';
import { useGetCatalogQuery, useGetFavoriteQuery, useSetFavoriteMutation } from '../api';
import { clean, BackToTop, ErrorState, image, RailLabel, Shell, SkeletonGrid, Spec, SyncStatus, useWarmDetail } from '../ui';
import { HeroPanelBeam } from '../ui/beam';
import { MovieRow } from '../ui/Rail';
import { useHeroEntrance } from '../ui/motion';
import type { Movie } from '../types';

/**
 * Tiêu đề hero: từ cuối đổi sang màu cam. Phim Việt hay có số phần ở cuối
 * ("Phần 2", "Mùa 3") nên tách theo khoảng trắng là đủ, không cần regex phức tạp.
 */
function HeroTitle({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : undefined;
  return <h1 className="hero-title">
    {words.join(' ')}{last ? <> <i className="hero-accent">{last}</i></> : null}
  </h1>;
}

function FavoriteButton({ movie }: { movie: Movie }) {
  // Phim lấy trực tiếp từ nguồn ngoài chưa có id trong DB — không có gì để lưu.
  const enabled = Number.isFinite(movie.id) && movie.id > 0;
  const { data } = useGetFavoriteQuery(movie.id, { skip: !enabled });
  const [setFavorite, { isLoading }] = useSetFavoriteMutation();
  if (!enabled) return null;
  const saved = data?.favorite ?? false;
  return <button
    className={saved ? 'button ghost active' : 'button ghost'} disabled={isLoading}
    onClick={() => setFavorite({ movieId: movie.id, enabled: !saved })}
  >
    <Star fill={saved ? 'currentColor' : 'none'} />{saved ? 'Đã lưu' : 'Lưu phim này'}
  </button>;
}

function NextUp({ items }: { items: Movie[] }) {
  const warm = useWarmDetail();
  if (!items.length) return null;
  return <div className="next-up">
    <RailLabel prefix="TIẾP THEO">Xem gì nữa</RailLabel>
    <div className="next-grid">
      {items.map((movie) => <Link key={movie.slug} to={`/movie/${movie.slug}`} state={{ preview: movie }} onPointerDown={warm(movie)}>
        <div><img src={image(movie, true) || '/poster-placeholder.svg'} alt={movie.name} loading="lazy" decoding="async" sizes="180px" /></div>
        <b>{movie.name}</b>
      </Link>)}
    </div>
  </div>;
}

/**
 * Mở màn trang chủ. Tách khỏi `Home` để timeline GSAP bám theo `featured`:
 * dữ liệu về sau mount, `useHeroEntrance` diễn lại mỗi khi đổi phim nổi bật.
 */
function Hero({ featured, next, warm }: { featured: Movie; next: Movie[]; warm: (movie: Movie) => () => void }) {
  const scope = useHeroEntrance<HTMLElement>([featured.slug]);
  return <section className="hero" ref={scope}>
    {/* fetchPriority + không lazy: đây là ảnh LCP của trang chủ. */}
    <img data-motion="media" className="hero-media" src={image(featured, true) || '/poster-placeholder.svg'} alt="" fetchPriority="high" decoding="async" />
    <div className="hero-veil" />
    <div className="hero-layout">
      <div className="hero-copy" data-motion="copy">
        <span className="hero-eyebrow">{featured.genres?.[0] ?? 'Đang nổi'} · {featured.type === 'series' || featured.type === 'tv' ? 'Phim bộ' : 'Phim lẻ'}</span>
        <HeroTitle name={featured.name} />
        <FavoriteButton movie={featured} />
      </div>
      <HeroPanelBeam>
      <aside className="hero-panel hero-panel--beam">
        <span className="hero-eyebrow">{featured.originName || 'Mới về kho'}</span>
        <Spec movie={featured} />
        <p className="description">{clean(featured.description) || `Xem ${featured.name} ngay trên kho phim của gia đình.`}</p>
        <div className="actions">
          <Link className="button primary" to={`/movie/${featured.slug}`} state={{ preview: featured }} onPointerDown={warm(featured)}><Play fill="currentColor" />Phát</Link>
          <Link className="button ghost" to={`/movie/${featured.slug}`} state={{ preview: featured }} onPointerDown={warm(featured)}><Film />Chi tiết</Link>
        </div>
        <NextUp items={next} />
      </aside>
      </HeroPanelBeam>
    </div>
  </section>;
}

export default function Home() {
  /**
   * `page`/`limit` của dải đầu này phải khớp với request mà `index.html` bắn
   * trước lúc còn đang parse HTML — lệch một con số là URL khác đi, câu trả lời
   * bắn trước không được nhặt và trang chủ lại chờ một round-trip như cũ.
   */
  const home = useGetCatalogQuery({ kind: 'home', page: 1, limit: 24 });
  const warm = useWarmDetail();
  const series = useGetCatalogQuery({ kind: 'list', value: 'phim-bo', page: 1, limit: 12 });
  const movies = useGetCatalogQuery({ kind: 'list', value: 'phim-le', page: 1, limit: 12 });
  const ultra = useGetCatalogQuery({ kind: 'list', value: '4k', page: 1, limit: 12 });
  const items = home.data?.items ?? [];
  const featured = items[0];
  const next = items.slice(1, 3);
  const top = useMemo(() => [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10), [home.data]);

  if (home.isError && !featured) {
    return <Shell><div className="page-container page-top"><ErrorState onRetry={home.refetch} /></div></Shell>;
  }
  return <Shell flush>
    {featured
      ? <Hero featured={featured} next={next} warm={warm} />
      : <div className="hero-skeleton" />}
    <div className="page-container page-top">
      <SyncStatus />
      {home.isLoading
        ? <SkeletonGrid />
        : <MovieRow label="Mới cập nhật" title="Vừa thêm vào kho" items={items} to="/browse/list/phim-moi-cap-nhat" />}
      <MovieRow label="Điểm cao" title="Đáng xem nhất" items={top} to="/browse/list/phim-moi-cap-nhat?sort=rating" ranked />
      <MovieRow label="Phim bộ" title="Xem dài hơi" items={series.data?.items ?? []} to="/browse/list/phim-bo" />
      <MovieRow label="Phim lẻ" title="Xem một buổi" items={movies.data?.items ?? []} to="/browse/list/phim-le" />
      <MovieRow label="Chất lượng" title="Bản 4K" items={ultra.data?.items ?? []} to="/browse/list/4k" />
    </div>
    <BackToTop />
  </Shell>;
}
