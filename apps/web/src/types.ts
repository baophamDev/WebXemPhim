export interface Episode { id:number; movieId:number; serverName:string; name:string; episodeNumber:number|null; embedUrl:string; m3u8Url:string|null }
export interface Movie { id:number; provider:string; providerId:string|null; slug:string; name:string; originName:string|null; description:string|null; type:string; status:string|null; year:number|null; duration:string|null; quality:string|null; language:string|null; posterUrl:string|null; thumbUrl:string|null; trailerUrl:string|null; rating:number|null; viewCount:number; tmdbId:string|null; imdbId:string|null; genres:string[]; countries:string[]; actors:string[]; directors:string[]; episodes?:Episode[] }
export interface MovieList { items:Movie[]; pagination:{totalItems:number;totalPages:number;currentPage:number;totalItemsPerPage:number} }
export interface TaxonomyItem { id:string|number; name:string; slug:string; thumbUrl:string|null }
export interface TaxonomyList { items:TaxonomyItem[] }
export interface SyncState { status:'idle'|'running'|'completed'|'error'|string; page:number; totalPages:number; processed:number; error?:string|null; updatedAt?:string }
export type CatalogKind='home'|'list'|'genre'|'country'|'year'|'code';
export interface CatalogQuery { kind:CatalogKind; value?:string; page?:number; limit?:number; year?:string; country?:string; category?:string; type?:string; status?:string }
