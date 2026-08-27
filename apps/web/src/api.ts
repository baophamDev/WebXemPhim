import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { CatalogQuery, Episode, Movie, MovieList, Navigation, Person, PersonList, SyncState, TaxonomyList, UnifiedSearch } from './types';

export const deviceId=localStorage.getItem('cinema-device-id')??crypto.randomUUID();
localStorage.setItem('cinema-device-id',deviceId);
const apiBaseUrl=(import.meta.env.VITE_API_URL??'/api').replace(/\/$/,'');

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
