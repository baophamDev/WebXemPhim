export interface Episode { id:number; movieId:number; serverName:string; name:string; episodeNumber:number|null; embedUrl:string; m3u8Url:string|null }
/** Diễn viên/đạo diễn kèm slug để link sang trang người. */
export interface CastMember { name:string; slug:string; thumbUrl:string|null; kind:'actor'|'director' }
export interface Person { id:number; name:string; slug:string; thumbUrl:string|null; movieCount:number; kinds?:('actor'|'director')[] }
export interface Movie { id:number; provider:string; providerId:string|null; slug:string; name:string; originName:string|null; description:string|null; type:string; status:string|null; year:number|null; duration:string|null; quality:string|null; language:string|null; posterUrl:string|null; thumbUrl:string|null; trailerUrl:string|null; rating:number|null; viewCount:number; tmdbId:string|null; imdbId:string|null; genres:string[]; countries:string[]; actors:string[]; directors:string[]; cast?:CastMember[]; episodes?:Episode[] }
export interface Pagination { totalItems:number; totalPages:number; currentPage:number; totalItemsPerPage:number }
export interface MovieList { items:Movie[]; pagination:Pagination }
export interface PersonList { items:Person[]; pagination:Pagination }
export interface TaxonomyItem { id:string|number; name:string; slug:string; thumbUrl:string|null; count?:number }
export interface TaxonomyList { items:TaxonomyItem[] }
/** Một request cho cả menu, thay vì 3 request song song lúc mở trang. */
export interface Navigation { genres:TaxonomyItem[]; countries:TaxonomyItem[]; years:TaxonomyItem[] }
/** Kết quả tìm kiếm hợp nhất: phim trùng tên + người trùng tên. */
export interface UnifiedSearch { query:string; movies:MovieList; people:Person[] }
export interface SyncState { status:'idle'|'running'|'completed'|'error'|string; page:number; totalPages:number; processed:number; error?:string|null; updatedAt?:string }
export type CatalogKind='home'|'list'|'genre'|'country'|'year'|'code';
export interface CatalogQuery { kind:CatalogKind; value?:string; page?:number; limit?:number; year?:string; country?:string; category?:string; type?:string; status?:string }
