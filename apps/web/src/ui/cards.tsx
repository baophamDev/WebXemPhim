/** Thẻ phim và những mảnh nhỏ đi kèm nó: nhãn mục, dòng thông số. */
import { Link } from 'react-router-dom';
import { Play, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePrefetch } from '../api';
import { rememberMovie } from '../preview';
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

export function MovieCard({ movie, rank }: { movie: Movie; rank?: number }) {
  const prefetch = usePrefetch('getMovie');
  /**
   * `pointerdown` là tín hiệu chắc chắn nhất mà vẫn đến **trước** lúc router đổi
   * trang (navigation xảy ra ở `click`, tức là ở mouseup). Nhờ vậy job nhập phim ở
   * API đã bắt đầu trước khi trang chi tiết mở ra, và cú bấm mua được vài trăm ms.
   *
   * Cố tình không prefetch khi mới trỏ chuột vào: kéo chuột ngang một dải phim là
   * 20 thẻ, thành 20 job nhập ở nguồn ngoài cho những phim không ai định xem.
   */
  const warm = () => { rememberMovie(movie); prefetch(movie.slug); };
  // draggable=false: thẻ nằm trong dải kéo ngang được, mà mặc định trình duyệt
  // cho kéo cả link và ảnh — ảnh mờ bay theo con trỏ làm cú kéo trông như lỗi.
  return <Link
    className="movie-card" to={`/movie/${movie.slug}`} draggable={false} aria-label={`Chi tiết ${movie.name}`}
    // Bản mô tả đi kèm cú điều hướng: trang chi tiết vẽ được poster/tên/năm ngay,
    // không phải đợi API. Xem `src/preview.ts`.
    state={{ preview: movie }}
    onPointerDown={warm} onClick={() => rememberMovie(movie)}
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
