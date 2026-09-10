import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Pause, Play, Star } from 'lucide-react';
import { useGetCatalogQuery, useGetFavoriteQuery, useSetFavoriteMutation } from '../api';
import { clean, BackToTop, ErrorState, Header, image, NavigationEffects, RailLabel, Shell, SiteFooter, SkeletonGrid, Spec, SyncStatus, useHeroRotation, useWarmDetail } from '../ui';
import { HeroPanelBeam } from '../ui/beam';
import { MovieRow } from '../ui/Rail';
import { useHeroEntrance, useHeroPin, useFloatingHeader, useSmoothScroll } from '../ui/motion';
import type { Movie, MovieList } from '../types';

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

/** Hai phim kế tiếp trong vòng xoay, bỏ qua phim đang chiếu. */
function nextUp(rotation: Movie[], index: number): Movie[] {
  if (rotation.length < 3) return rotation.filter((_, i) => i !== index);
  return [rotation[(index + 1) % rotation.length], rotation[(index + 2) % rotation.length]];
}

/** Chỉ ảnh của phim đầu tiên là LCP; các ảnh sau do hero xoay mang tính trang trí. */
const highPriority = (index: number) => (index === 0 ? 'high' : 'auto') as 'high' | 'auto';

/**
 * Chỉ báo bấm-chọn của hero: mỗi phim đang xoay một vạch, vạch đang phát có
 * thanh tiến trình chạy đúng 10s của một chu kỳ. Vạch là <button> để bấm chọn
 * phim luôn, không phải chờ hết chu kỳ.
 */
function HeroDots({ items, index, onSelect }: { items: Movie[]; index: number; onSelect: (i: number) => void }) {
  if (items.length < 2) return null;
  return <div className="hero-dots" role="group" aria-label="Chọn phim nổi bật">
    {items.map((movie, i) => <button
      key={movie.slug}
      type="button"
      className={i === index ? 'on' : ''}
      aria-label={i === index ? `Đang chiếu: ${movie.name}` : `Chuyển sang ${movie.name}`}
      onClick={() => onSelect(i)}
    ><i /></button>)}
  </div>;
}

/**
 * Mở màn trang chủ. Tách khỏi `Home` để timeline GSAP bám theo `featured`:
 * dữ liệu về sau mount, `useHeroEntrance` diễn lại mỗi khi đổi phim nổi bật.
 *
 * Hero tự nhảy phim tiếp theo trong `rotation` mỗi 10 giây (xem ui/heroRotate);
 * con trỏ vào hero thì tạm dừng, rời đi thì nhịp chạy lại từ đầu chu kỳ.
 */
function Hero({ rotation, warm }: { rotation: Movie[]; warm: (movie: Movie) => () => void }) {
  const [hold, setHold] = useState(false);
  const [manual, setManual] = useState<number | null>(null);
  const auto = useHeroRotation(rotation, hold);
  const index = manual ?? auto;
  const featured = rotation[index] ?? rotation[0];

  // Người dùng bấm chọn phim: lấy quyền điều khiển khỏi bộ đếm. Bấm lại đúng
  // vạch hiện tại thì trả về cho bộ đếm — hành vi bật/tắt quen thuộc của nút phát.
  const select = (i: number) => {
    if (i === index && manual !== null) setManual(null);
    else { setManual(i); setHold(false); }
  };

  // Ảnh của phim kế tiếp về sẵn trước khi tới lượt: cú chuyển không còn trống
  // trắng chờ tải. Hai link trong panel trỏ phim hiện tại nên khóa theo slug.
  const upcoming = rotation[(index + 1) % rotation.length];
  useEffect(() => {
    const url = upcoming && image(upcoming, true);
    if (!url) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    return () => { img.src = ''; };
  }, [upcoming]);

  const scope = useHeroEntrance<HTMLElement>([featured.slug]);
  return <section className="hero" ref={scope}
    onPointerEnter={() => setHold(true)}
    onPointerLeave={() => setHold(false)}
  >
    {/* fetchPriority + không lazy: đây là ảnh LCP của trang chủ. `key` đổi theo
        slug để đổi phim là một <img> mới — không bắn request ảnh cũ đang dở. */}
    <img
      key={featured.slug} data-motion="media" className="hero-media"
      src={image(featured, true) || '/poster-placeholder.svg'}
      alt="" fetchPriority={highPriority(index)} decoding="async"
    />
    <div className="hero-veil" />
    {/* Lớp phủ tối + mờ dần khi sheet nội dung trượt lên che hero (GSAP scrub). */}
    <div className="hero-overlay" aria-hidden="true" />
    <div className="hero-layout">
      <div className="hero-copy" data-motion="copy">
        <HeroTitle name={featured.name} />
        <span className="hero-eyebrow">{featured.genres?.[0] ?? 'Đang nổi'} · {featured.type === 'series' || featured.type === 'tv' ? 'Phim bộ' : 'Phim lẻ'}</span>
        <FavoriteButton movie={featured} />
      </div>
      <HeroPanelBeam>
      <aside className="hero-panel hero-panel--beam" key={featured.slug}>
        <span className="hero-eyebrow">{featured.originName || 'Mới về kho'}</span>
        <Spec movie={featured} />
        <p className="description">{clean(featured.description) || `Xem ${featured.name} ngay trên kho phim của gia đình.`}</p>
        <div className="actions">
          <Link className="button primary" to={`/movie/${featured.slug}`} state={{ preview: featured }} onPointerDown={warm(featured)}><Play fill="currentColor" />Phát</Link>
          <Link className="button ghost" to={`/movie/${featured.slug}`} state={{ preview: featured }} onPointerDown={warm(featured)}><Film />Chi tiết</Link>
          {rotation.length > 1 && <button
            type="button" className="button ghost hero-toggle" aria-hidden="true" tabIndex={-1}
            onClick={() => setHold((h) => !h)}
          >{hold ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}</button>}
        </div>
        <HeroDots items={rotation} index={index} onSelect={select} />
        <NextUp items={nextUp(rotation, index)} />
      </aside>
      </HeroPanelBeam>
    </div>
  </section>;
}

export default function Home() {
  /**
   * `page` của dải đầu phải khớp request mà `index.html` bắn trước lúc còn đang
   * parse HTML — lệch một con số là URL khác đi, câu trả lời bắn trước không
   * được nhặt và trang chủ lại chờ một round-trip như cũ. Không gửi `limit`:
   * VSMOV ép riêng cho từng nhóm endpoint (`phim-moi-cap-nhat` luôn 24) và bỏ
   * qua tham số này.
   */
  const home = useGetCatalogQuery({ kind: 'home', page: 1 });
  const warm = useWarmDetail();
  // Nhóm /danh-sach/:slug của VSMOV bỏ limit nhưng đọc type: phim-bo/phim-le
  // trả đúng danh sách đó, mỗi request 20 mục — vừa một dải cuốn ngang.
  const series = useGetCatalogQuery({ kind: 'list', value: 'phim-bo', page: 1 });
  const movies = useGetCatalogQuery({ kind: 'list', value: 'phim-le', page: 1 });
  const cinema = useGetCatalogQuery({ kind: 'list', value: 'phim-chieu-rap', page: 1 });
  const ultra = useGetCatalogQuery({ kind: 'list', value: '4k', page: 1 });
  const items = home.data?.items ?? [];
  // Danh sách xoay hero: 5 phim đầu của trang, chỉ giữ phim có ảnh ngang làm
  // nền (thiếu thì vạch đó sẽ hiện poster dọc bị kéo căng — đúng lỗi vừa sửa).
  const rotation = useMemo(() => items.filter((movie) => image(movie, true)).slice(0, 5), [home.data]);
  const featured = items[0];
  // VSMOV không hỗ trợ sort theo điểm (thử sort_field trên nguồn: thứ tự không
  // đổi), nên "Điểm cao" xếp ở client từ rating TMDB của chính các phim mới về.
  const top = useMemo(() => [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10), [home.data]);

  if (home.isError && !featured) {
    return <Shell><div className="page-container page-top"><ErrorState onRetry={home.refetch} /></div></Shell>;
  }
  // Chưa có phim nổi bật thì giữ layout khung thường (skeleton trong Shell).
  if (!featured) {
    return <Shell flush>
      <div className="hero-skeleton" />
      <div className="page-container page-top">
        <SyncStatus />
        <SkeletonGrid />
      </div>
      <BackToTop />
    </Shell>;
  }
  return <HomePinned rotation={rotation} warm={warm} home={home} series={series} movies={movies} cinema={cinema} ultra={ultra} items={items} top={top} />;
}

/**
 * Layout trang chủ khi đã có hero: header + hero RỜI KHỎI khung viền, dựng
 * full-bleed làm lớp nền; khung viền aurora (`.home-frame`) chỉ bọc từ sheet
 * nội dung trở xuống và trượt lên che hero khi cuộn.
 *
 * Thứ tự lớp: `.home-bg` fixed đứng yên → `.home-frame` relative + margin-top
 * đẩy xuống dưới viewport → cuộn thì frame phủ lên nền. Chỉ bật khi đã có
 * `featured`; skeleton/error đi nhánh Shell thường ở trên.
 */
function HomePinned({ rotation, warm, home, series, movies, cinema, ultra, items, top }: {
  rotation: Movie[]; warm: (movie: Movie) => () => void;
  home: { isLoading: boolean }; series: { data?: MovieList }; movies: { data?: MovieList }; cinema: { data?: MovieList }; ultra: { data?: MovieList };
  items: Movie[]; top: Movie[];
}) {
  const featured = rotation[0];
  const pin = useHeroPin<HTMLDivElement>(true, [featured.slug, items.length]);
  const smooth = useSmoothScroll<HTMLDivElement>(true, [featured.slug, items.length]);
  const float = useFloatingHeader<HTMLDivElement>([featured.slug, items.length]);
  const homeRef = (node: HTMLDivElement | null) => { pin.current = node; smooth.current = node; };
  return <div className="home" ref={homeRef}>
    <NavigationEffects />
    <div className="home-bg">
      <Hero rotation={rotation} warm={warm} />
    </div>
    {/* Header tách khỏi nền fixed: là thanh fixed riêng nên khi khung viền trượt
        lên che hero, header vẫn nổi trên nội dung thay vì bị chìm theo nền. */}
    <div className="home-header-actions" ref={float}>
      <Header />
    </div>
    <div className="app-frame home-frame">
      <main>
        <div className="page-container page-top home-sheet">
          <SyncStatus />
          {home.isLoading
            ? <SkeletonGrid />
            : <MovieRow label="Mới cập nhật" title="Vừa thêm vào kho" items={items} to="/browse/list/phim-moi-cap-nhat" />}
          <MovieRow label="Điểm cao" title="Đáng xem nhất" items={top} to="/browse/list/phim-moi-cap-nhat" ranked />
          <MovieRow label="Chiếu rạp" title="Đang chiếu tại rạp" items={cinema.data?.items ?? []} to="/browse/list/phim-chieu-rap" />
          <MovieRow label="Phim bộ" title="Xem dài hơi" items={series.data?.items ?? []} to="/browse/list/phim-bo" />
          <MovieRow label="Phim lẻ" title="Xem một buổi" items={movies.data?.items ?? []} to="/browse/list/phim-le" />
          <MovieRow label="Chất lượng" title="Bản 4K" items={ultra.data?.items ?? []} to="/browse/list/4k" />
        </div>
      </main>
      <SiteFooter />
    </div>
    <BackToTop />
  </div>;
}
