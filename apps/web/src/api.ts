import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { CatalogQuery, Episode, Movie, MovieList, Navigation, Person, PersonList, SyncState, TaxonomyList, UnifiedSearch } from './types';

/**
 * crypto.randomUUID chỉ có trong secure context. Mở web qua IP LAN
 * (http://192.168.x.x:5173) thì nó undefined, và vì dòng này chạy ở cấp module
 * nên cả app sẽ trắng trang. Có fallback để mạng nội bộ vẫn dùng được.
 */
function newDeviceId(){
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}
function readDeviceId(){
  try{
    const saved=localStorage.getItem('cinema-device-id');
    if(saved)return saved;
    const fresh=newDeviceId();
    localStorage.setItem('cinema-device-id',fresh);
    return fresh;
  }catch{
    // Chặn cookie/storage thì vẫn cho xem, chỉ mất tính năng "xem tiếp".
    return newDeviceId();
  }
}
export const deviceId=readDeviceId();
const apiBaseUrl=(import.meta.env.VITE_API_URL??'/api').replace(/\/$/,'');

/**
 * Base URL tương đối ('/api') chỉ chạy được khi có proxy cùng origin: dev server
 * của Vite proxy sang localhost:4000. Trên Vercel không có proxy nào — mọi
 * đường dẫn bị rewrite về index.html, nên fetch '/api/health' nhận HTML và
 * RTK Query báo lỗi parse; UI hiểu thành "API ngoại tuyến". Cảnh báo sớm ở
 * console và cho SyncStatus hiện đúng nguyên nhân thay vì "cổng 4000".
 */
export const apiBaseIsRelative=!/^https?:\/\//i.test(apiBaseUrl);
export function apiOfflineHint(){
  const local=typeof location!=='undefined'&&/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if(apiBaseIsRelative&&!local)return 'VITE_API_URL đang là đường dẫn tương đối — cần trỏ sang URL API thật';
  if(apiBaseIsRelative)return 'Không gọi được dịch vụ ở cổng 4000';
  return `Không gọi được ${apiBaseUrl}`;
}
if(apiBaseIsRelative&&typeof location!=='undefined'&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)){
  console.warn(`[api] VITE_API_URL="${apiBaseUrl}" là đường dẫn tương đối nhưng web không chạy ở localhost. Đặt VITE_API_URL thành URL đầy đủ của API (vd https://<app>.up.railway.app/api).`);
}

function catalogUrl(kind:CatalogQuery['kind'],value?:string){
  if(kind==='home')return '/catalog/home';
  const segment={list:'lists',genre:'genres',country:'countries',year:'years',code:'codes'}[kind];
  return `/catalog/${segment}/${encodeURIComponent(value??'')}`;
}

export const cinemaApi=createApi({
  reducerPath:'cinemaApi',
  baseQuery:fetchBaseQuery({baseUrl:apiBaseUrl}),
  tagTypes:['Movie','Sync','Favorite','Progress','Health'],
  endpoints:(builder)=>({
    getCatalog:builder.query<MovieList,CatalogQuery>({query:({kind,value,...params})=>({url:catalogUrl(kind,value),params})}),
    searchCatalog:builder.query<MovieList,{q:string;page?:number;limit?:number;type?:string;status?:string;year?:string}>({query:({q,...params})=>({url:'/catalog/search',params:{q,...params}})}),
    searchVsmov:builder.query<MovieList,{q:string;page?:number;limit?:number}>({query:({q,...params})=>({url:'/vsmov/search',params:{q,...params}})}),
    getTaxonomy:builder.query<TaxonomyList,'genres'|'countries'|'years'|'actors'|'codes'>({query:(kind)=>`/catalog/${kind}`}),
    // Menu điều hướng đổi rất chậm — giữ cache 10 phút để không gọi lại mỗi lần đổi route.
    getNavigation:builder.query<Navigation,void>({query:()=>'/catalog/navigation',keepUnusedDataFor:600}),
    getMovie:builder.query<{movie:Movie},string>({query:(slug)=>`/catalog/movies/${encodeURIComponent(slug)}`,providesTags:(_r,_e,slug)=>[{type:'Movie',id:slug}]}),
    getLocalMovies:builder.query<MovieList,{page?:number;limit?:number;q?:string;genre?:string;country?:string;year?:number;type?:string;person?:string;personKind?:'actor'|'director';sort?:string}>({query:(p)=>({url:'/movies',params:{...p,page:p.page??1,limit:p.limit??24}}),providesTags:['Movie']}),
    // Tìm kiếm hợp nhất trên DB: một từ khoá trả về cả phim và người, không dấu.
    searchAll:builder.query<UnifiedSearch,{q:string;page?:number;limit?:number}>({query:({q,...params})=>({url:'/search',params:{q,...params}})}),
    getPeople:builder.query<PersonList,{q?:string;kind?:'actor'|'director';page?:number;limit?:number}>({query:(p)=>({url:'/people',params:{...p,page:p.page??1,limit:p.limit??60}})}),
    getPerson:builder.query<{person:Person}&MovieList,{slug:string;page?:number;kind?:'actor'|'director'}>({query:({slug,...params})=>({url:`/people/${encodeURIComponent(slug)}`,params})}),
    getLocalMovie:builder.query<{movie:Movie},string>({query:(slug)=>`/movies/${encodeURIComponent(slug)}`,providesTags:(_r,_e,slug)=>[{type:'Movie',id:`local-${slug}`}] }),
    getEpisode:builder.query<Episode,number>({query:(id)=>`/episodes/${id}`}),
    getHealth:builder.query<{ok:boolean;service:string;time:string},void>({query:()=>'/health',providesTags:['Health']}),
    getSync:builder.query<SyncState,void>({query:()=>'/sync/status',providesTags:['Sync']}),
    startSync:builder.mutation<any,{pages:number}>({query:(body)=>({url:'/sync/start',method:'POST',body}),invalidatesTags:['Sync']}),
    importMovie:builder.mutation<{movie:Movie},string>({query:(slug)=>({url:`/import/${encodeURIComponent(slug)}`,method:'POST'}),invalidatesTags:['Movie']}),
    getFavorites:builder.query<{items:Movie[]},void>({query:()=>({url:'/favorites',params:{deviceId}}),providesTags:['Favorite']}),
    getFavorite:builder.query<{favorite:boolean},number>({query:(id)=>({url:`/favorites/${id}`,params:{deviceId}}),providesTags:(_r,_e,id)=>[{type:'Favorite',id}]}),
    setFavorite:builder.mutation<{favorite:boolean},{movieId:number;enabled:boolean}>({query:({movieId,enabled})=>({url:`/favorites/${movieId}`,method:'POST',body:{deviceId,enabled}}),invalidatesTags:(_r,_e,x)=>['Favorite',{type:'Favorite',id:x.movieId}]}),
    saveProgress:builder.mutation<any,{episodeId:number;position:number;duration:number;completed?:boolean}>({query:(body)=>({url:'/watch-progress',method:'POST',body:{...body,deviceId}}),invalidatesTags:['Progress']}),
    getContinue:builder.query<{items:any[]},void>({query:()=>({url:'/continue-watching',params:{deviceId}}),providesTags:['Progress']})
  })
});

export const {useGetCatalogQuery,useSearchCatalogQuery,useSearchVsmovQuery,useGetTaxonomyQuery,useGetNavigationQuery,useSearchAllQuery,useGetPeopleQuery,useGetPersonQuery,useGetMovieQuery,useGetLocalMoviesQuery,useGetLocalMovieQuery,useGetEpisodeQuery,useGetHealthQuery,useGetSyncQuery,useStartSyncMutation,useImportMovieMutation,useGetFavoritesQuery,useGetFavoriteQuery,useSetFavoriteMutation,useSaveProgressMutation,useGetContinueQuery}=cinemaApi;
