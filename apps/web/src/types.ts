export interface Episode { id:number; movieId:number; serverName:string; name:string; episodeNumber:number|null; embedUrl:string; m3u8Url:string|null }
/** Diễn viên/đạo diễn kèm slug để link sang trang người. */
export interface CastMember { name:string; slug:string; thumbUrl:string|null; kind:'actor'|'director' }
export interface Person { id:number; name:string; slug:string; thumbUrl:string|null; movieCount:number; kinds?:('actor'|'director')[] }
export interface Movie { id:number; provider:string; providerId:string|null; slug:string; name:string; originName:string|null; description:string|null; type:string; status:string|null; year:number|null; duration:string|null; quality:string|null; language:string|null; posterUrl:string|null; thumbUrl:string|null; trailerUrl:string|null; rating:number|null; viewCount:number; tmdbId:string|null; imdbId:string|null; genres:string[]; countries:string[]; actors:string[]; directors:string[]; cast?:CastMember[]; episodes?:Episode[] }
export interface Pagination { totalItems:number; totalPages:number; currentPage:number; totalItemsPerPage:number }
/**
 * `source` là nguồn đã **thật sự** trả lời trang này (resolver đóng dấu vào mọi
 * response catalog). Optional vì các endpoint đọc thẳng DB (`/movies`, `/people`)
 * không đi qua nguồn ngoài nên không có gì để đóng dấu.
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
 * Trạng thái một nguồn catalog, trả về từ `GET /api/providers`. `healthy:false`
 * nghĩa là circuit breaker đang tạm ngừng gọi nguồn đó, không phải nguồn đã chết
 * hẳn — `openUntil` là lúc nó được thử lại.
 */
export interface SourceHealth { name:string; kind:'playable'|'metadata'; capabilities:string[]; healthy:boolean; failures:number; openUntil:string|null; lastError:string|null; lastSuccessAt:string|null }
/**
 * Nguồn có tên nhưng chưa dùng được (thiếu khoá API, chưa có adapter). Hiện mờ kèm
 * `hint` thay vì giấu đi: danh sách ba nguồn mà chỉ thấy hai thì trông như lỗi.
 */
export interface InactiveSource { name:string; kind:'playable'|'metadata'; hint:string }
/**
 * Chặng của một lần nhập phim, do API báo về. Bốn chặng giữa là các bước thật của
 * resolver (hỏi nguồn phát → hỏi nguồn metadata → tìm lại bằng tên → bồi metadata),
 * nên thanh tiến trình nói được việc đang làm chứ không phải một con số bịa.
 */
export type ImportStage='queued'|'playable'|'metadata'|'rematch'|'enrich'|'saving'|'ready'|'failed';
export interface ImportJob { slug:string; stage:ImportStage; source:string|null; startedAt:string; updatedAt:string; elapsedMs:number; error:string|null }
export type CatalogKind='home'|'list'|'genre'|'country'|'year'|'code';
export interface CatalogQuery { kind:CatalogKind; value?:string; page?:number; limit?:number; year?:string; country?:string; category?:string; type?:string; status?:string }
