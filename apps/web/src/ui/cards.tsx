/** Thẻ phim và những mảnh nhỏ đi kèm nó: nhãn mục, dòng thông số. */
import { Link } from 'react-router-dom';
import { Play, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePrefetch } from '../api';
import { preloadDetail } from '../chunks';
import { rememberMovie, type MoviePreview } from '../preview';
import type { Movie } from '../types';
import { image } from './format';

/** Nhãn mục dạng "MỤC // TÊN" — nhất quán cho mọi tiêu đề trên trang. */
export function RailLabel({ prefix, children }: { prefix: string; children: ReactNode }) {
  return <span className="rail-label">{prefix} // <b>{children}</b></span>;
}

export function Spec({ movie }: { movie: Movie }) {
  return <ul className="spec">
    {movie.rating ? <li className="rating"><Star fill="currentColor" />{movie.rating.toFixed(1)}</li> : null}
    {movie.year ? <li>{movie.year}</li> : null}
    <li>{movie.type === 'series' || movie.type === 'tv' ? 'Phim bộ' : 'Phim lẻ'}</li>
    {movie.duration ? <li>{movie.duration}</li> : null}
    {movie.quality ? <li><span className="tag">{movie.quality}</span></li> : null}
  </ul>;
}

/**
 * Hâm nóng trang chi tiết của một phim, dùng ở `pointerdown` của link dẫn tới nó.
 *
 * Ba việc trong một cú: ghi lại bản mô tả để trang đích vẽ được nửa trên ngay,
 * bắn trước request phim (API bắt đầu nhập ở nền), và kéo chunk của trang về.
 *
 * `pointerdown` là tín hiệu chắc chắn nhất mà vẫn đến **trước** lúc router đổi
 * trang (navigation xảy ra ở `click`, tức là ở mouseup), nên cú bấm mua được vài
 * trăm ms. Cố tình không làm khi mới trỏ chuột vào: kéo chuột ngang một dải phim
 * là 20 thẻ, thành 20 job nhập ở nguồn ngoài cho phim không ai định xem.
 *
 * Là hook chứ không phải hàm thường vì `usePrefetch` là hook; trả về một hàm dựng
 * handler để hero trang chủ và dải "Xem gì nữa" — hai link sang trang chi tiết
 * không đi qua `MovieCard` — dùng được cùng một logic.
 */
export function useWarmDetail() {
  const prefetch = usePrefetch('getMovie');
  return (movie: MoviePreview) => () => { rememberMovie(movie); prefetch(movie.slug); preloadDetail(); };
}

export function MovieCard({ movie, rank }: { movie: Movie; rank?: number }) {
  const warm = useWarmDetail();
  // draggable=false: thẻ nằm trong dải kéo ngang được, mà mặc định trình duyệt
  // cho kéo cả link và ảnh — ảnh mờ bay theo con trỏ làm cú kéo trông như lỗi.
  return <Link
    className="movie-card" to={`/movie/${movie.slug}`} draggable={false} aria-label={`Chi tiết ${movie.name}`}
    // Bản mô tả đi kèm cú điều hướng: trang chi tiết vẽ được poster/tên/năm ngay,
    // không phải đợi API. Xem `src/preview.ts`.
    state={{ preview: movie }}
    onPointerDown={warm(movie)} onClick={() => rememberMovie(movie)}
  >
    {rank ? <span className="rank">{rank}</span> : null}
    <div className="poster">
      <img
        src={image(movie) || '/poster-placeholder.svg'} alt={movie.name} draggable={false}
        loading="lazy" decoding="async" sizes="(max-width: 820px) 45vw, 15vw"
      />
      <span className="card-play"><Play fill="currentColor" /></span>
      <div className="badges">
        {movie.quality ? <b>{movie.quality}</b> : null}
        {movie.language ? <b>{movie.language.split('+')[0].trim()}</b> : null}
      </div>
    </div>
    <h3>{movie.name}</h3>
    <p className="spec-line">
      <span>{movie.year || 'Chưa rõ năm'}</span>
      {movie.rating ? <><Star fill="currentColor" />{movie.rating.toFixed(1)}</> : null}
    </p>
  </Link>;
}
