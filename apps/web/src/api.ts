import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { CatalogQuery, Episode, Movie, MovieList, SyncState, TaxonomyList } from './types';

export const deviceId=localStorage.getItem('cinema-device-id')??crypto.randomUUID();
localStorage.setItem('cinema-device-id',deviceId);

function catalogUrl(kind:CatalogQuery['kind'],value?:string){
  if(kind==='home')return '/catalog/home';
  const segment={list:'lists',genre:'genres',country:'countries',year:'years',code:'codes'}[kind];
  return `/catalog/${segment}/${encodeURIComponent(value??'')}`;
}

export const cinemaApi=createApi({
  reducerPath:'cinemaApi',
  baseQuery:fetchBaseQuery({baseUrl:'/api'}),
  tagTypes:['Movie','Sync','Favorite','Progress','Health'],
  endpoints:(builder)=>({
    getCatalog:builder.query<MovieList,CatalogQuery>({query:({kind,value,...params})=>({url:catalogUrl(kind,value),params})}),
    searchCatalog:builder.query<MovieList,{q:string;page?:number;limit?:number;type?:string;status?:string;year?:string}>({query:({q,...params})=>({url:'/catalog/search',params:{q,...params}})}),
    searchVsmov:builder.query<MovieList,{q:string;page?:number;limit?:number}>({query:({q,...params})=>({url:'/vsmov/search',params:{q,...params}})}),
    getTaxonomy:builder.query<TaxonomyList,'genres'|'countries'|'years'|'actors'|'codes'>({query:(kind)=>`/catalog/${kind}`}),
    getMovie:builder.query<{movie:Movie},string>({query:(slug)=>`/catalog/movies/${encodeURIComponent(slug)}`,providesTags:(_r,_e,slug)=>[{type:'Movie',id:slug}]}),
    getLocalMovies:builder.query<MovieList,{page?:number;q?:string;genre?:string;sort?:string}>({query:(p)=>({url:'/movies',params:{page:p.page??1,limit:24,q:p.q,genre:p.genre,sort:p.sort}}),providesTags:['Movie']}),
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

export const {useGetCatalogQuery,useSearchCatalogQuery,useSearchVsmovQuery,useGetTaxonomyQuery,useGetMovieQuery,useGetLocalMoviesQuery,useGetLocalMovieQuery,useGetEpisodeQuery,useGetHealthQuery,useGetSyncQuery,useStartSyncMutation,useImportMovieMutation,useGetFavoritesQuery,useGetFavoriteQuery,useSetFavoriteMutation,useSaveProgressMutation,useGetContinueQuery}=cinemaApi;
