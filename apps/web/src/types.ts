export interface Episode { id:number; movieId:number; serverName:string; name:string; episodeNumber:number|null; embedUrl:string; m3u8Url:string|null }
/** Diễn viên/đạo diễn kèm slug để link sang trang người. */
export interface CastMember { name:string; slug:string; thumbUrl:string|null; kind:'actor'|'director' }
export interface Person { id:number; name:string; slug:string; thumbUrl:string|null; movieCount:number; kinds?:('actor'|'director')[] }
export interface Movie { id:number; provider:string; providerId:string|null; slug:string; name:string; originName:string|null; description:string|null; type:string; status:string|null; year:number|null; duration:string|null; quality:string|null; language:string|null; posterUrl:string|null; thumbUrl:string|null; trailerUrl:string|null; rating:number|null; viewCount:number; tmdbId:string|null; imdbId:string|null; genres:string[]; countries:string[]; actors:string[]; directors:string[]; cast?:CastMember[]; episodes?:Episode[] }
export interface Pagination { totalItems:number; totalPages:number; currentPage:number; totalItemsPerPage:number }
/**
 * `source` luôn là `vsmov` ở các endpoint catalog. Optional vì các endpoint đọc
 * thẳng DB (`/movies`, `/people`) không đi qua nguồn ngoài.
 */
export interface MovieList { items:Movie[]; pagination:Pagination; source?:string }
export interface PersonList { items:Person[]; pagination:Pagination }
export interface TaxonomyItem { id:string|number; name:string; slug:string; thumbUrl:string|null; count?:number }
export interface TaxonomyList { items:TaxonomyItem[]; source?:string }
/** Một request cho cả menu, thay vì 3 request song song lúc mở trang. */
export interface Navigation { genres:TaxonomyItem[]; countries:TaxonomyItem[]; years:TaxonomyItem[] }
/** Kết quả tìm kiếm hợp nhất: phim trùng tên + người trùng tên. */
export interface UnifiedSearch { query:string; movies:MovieList; people:Person[] }
export interface SyncState { status:'idle'|'running'|'completed'|'error'|string; page:number; totalPages:number; processed:number; error?:string|null; updatedAt?:string }
/**
 * Chặng của một lần nhập phim từ VSMOV, do API báo về.
 */
export type ImportStage='queued'|'loading'|'saving'|'ready'|'failed';
export interface ImportJob { slug:string; stage:ImportStage; source:string|null; startedAt:string; updatedAt:string; elapsedMs:number; error:string|null }
export type CatalogKind='home'|'list'|'genre'|'country'|'year'|'code';
export interface CatalogQuery { kind:CatalogKind; value?:string; page?:number; limit?:number; year?:string; country?:string; category?:string; type?:string; status?:string }
/**
 * Một bản phụ đề tìm thấy ở nguồn ngoài. `id` là thẻ do API tự đặt, web chỉ đưa lại
 * nguyên văn khi bấm tải — hình dạng bên trong (file_id của OpenSubtitles, đường dẫn
 * zip của SubDL) là việc của API, không phải của web.
 */
export interface SubtitleHit { provider:string; id:string; name:string; lang:string; langLabel:string; release:string|null; downloads:number|null; hearingImpaired:boolean; episode:number|null }
/**
 * Nguồn sub nào đang dùng được. Thiếu khoá API là chuyện thường (quota miễn phí rất
 * thấp) nên phải nói ra bằng `note`, không được im lặng trả về danh sách rỗng.
 */
export interface SubtitleProviderState { name:string; ok:boolean; note:string|null }
export interface SubtitleSearch { query:string; hits:SubtitleHit[]; providers:SubtitleProviderState[] }
/**
 * File sub ở dạng **byte thô** base64. API không tự chuyển sang VTT: web đã có bộ
 * chuyển đổi cho file người xem tự chọn (`src/subs/convert.ts`), và cho sub tải về đi
 * đúng đường đó nghĩa là hai lối không thể lệch nhau về bảng mã hay cách dọn thẻ.
 */
export interface SubtitleFile { provider:string; filename:string; base64:string; bytes:number }
