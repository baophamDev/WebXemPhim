/**
 * Kho tạm những phim đã hiện trên màn hình.
 *
 * Vấn đề nó giải: bấm vào một phim chưa từng xem thì `GET /api/movies/:slug` chưa
 * có gì trả về (API đang nhập ở nền), nên trang chi tiết không có dữ liệu và trước
 * đây vẽ một vòng xoay toàn trang. Nhưng cái thẻ phim vừa bấm **đã có** poster,
 * tên, năm, điểm — đủ để vẽ phần đầu trang ngay lập tức. Thiếu chỉ là danh sách
 * tập, và đó đúng là thứ đang được kéo về.
 *
 * Nên mỗi thẻ phim ghi lại bản mô tả của nó vào đây trước khi điều hướng. Trang
 * chi tiết đọc ra và vẽ liền, rồi thay bằng bản đầy đủ khi API trả lời.
 *
 * Vì sao là module state chứ không phải Redux: dữ liệu này thuần cache hiển thị,
 * không ai cần đọc nó một cách phản ứng (trang chi tiết đọc **một lần** lúc mở).
 * Đưa vào store thì mỗi lần hover một thẻ phim là một action và một lần render lại
 * cả cây — đắt hơn nhiều so với việc nó giải quyết.
 *
 * Cache chỉ sống trong một lần mở tab. Tải lại trang (F5) là mất, và đó là đúng:
 * lúc đó không có "thẻ phim vừa bấm" nào, trang chi tiết rơi về khung xương.
 */
import type { Movie } from './types';

/** Bản mô tả phim lấy từ danh sách: có mọi field trừ `episodes` và `cast`. */
export type MoviePreview=Omit<Movie,'episodes'|'cast'>&{episodes?:Movie['episodes'];cast?:Movie['cast']};

/** Trần cứng: duyệt vài chục trang danh sách là hàng nghìn thẻ, không giữ hết. */
const LIMIT=400;
const previews=new Map<string,MoviePreview>();

/**
 * Ghi nhớ một phim. Map giữ thứ tự chèn, nên xoá khoá đầu tiên là xoá phim cũ
 * nhất; ghi lại một phim đã có thì xoá rồi chèn lại để nó về cuối hàng (LRU thô
 * nhưng đủ: phim vừa xem là phim dễ được mở lại nhất).
 */
export function rememberMovie(movie:MoviePreview|undefined|null){
  if(!movie?.slug)return;
  if(previews.has(movie.slug))previews.delete(movie.slug);
  previews.set(movie.slug,movie);
  if(previews.size>LIMIT){
    const oldest=previews.keys().next().value;
    if(oldest!==undefined)previews.delete(oldest);
  }
}

export function rememberMovies(movies:readonly MoviePreview[]|undefined|null){
  if(!movies)return;
  for(const movie of movies)rememberMovie(movie);
}

export function recallMovie(slug:string|undefined):MoviePreview|null{
  return slug?previews.get(slug)??null:null;
}

/**
 * Bản mô tả kèm theo cú điều hướng (`<Link state>`), nếu có. Router state đến
 * trước cả kho tạm ở trên trong một trường hợp: mở link ở tab mới rồi bấm back,
 * lúc đó kho tạm của tab mới trống nhưng state của history vẫn còn.
 */
export function previewFromState(state:unknown):MoviePreview|null{
  const preview=(state as {preview?:MoviePreview}|null)?.preview;
  return preview?.slug?preview:null;
}
