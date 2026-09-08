/**
 * Hàm thuần dùng chung cho giao diện: nhãn, chọn ảnh, dọn HTML của nguồn.
 * Không import React ở đây để mấy hàm này gọi được từ bất cứ đâu, kể cả test.
 */
import type { Movie } from '../types';

export const listLabels: Record<string, string> = {
  'phim-moi-cap-nhat': 'Mới cập nhật', 'phim-le': 'Phim lẻ', 'phim-bo': 'Phim bộ',
  'phim-chieu-rap': 'Phim chiếu rạp', '4k': 'Phim 4K', subteam: 'Subteam'
};

/**
 * Chọn ảnh theo hướng hiển thị, khớp quy ước ngược tên của VSMOV: `poster_url`
 * là ảnh ngang (backdrop 1920×1080...) còn `thumb_url` là poster dọc 2:3.
 * Nguồn thiếu cái nào thì lấy cái còn lại (CSS object-fit tự cắt cho vừa khung).
 */
export const image = (movie: Movie, wide = false) => (wide ? movie.posterUrl || movie.thumbUrl : movie.thumbUrl || movie.posterUrl);

/** Mô tả của nguồn có thẻ HTML lẫn trong; bỏ hết để không chèn markup lạ vào trang. */
export const clean = (html: string | null) => (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

export const humanize = (value: string) => decodeURIComponent(value).replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

/** Người dùng đã tắt hiệu ứng trong hệ điều hành: cuộn nhảy thẳng, không chạy mượt. */
export const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
