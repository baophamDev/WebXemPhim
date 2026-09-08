import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { bootUrl, claimBoot } from './boot';
import type { CatalogQuery, Episode, ImportJob, Movie, MovieList, Navigation, Person, PersonList, SubtitleFile, SubtitleSearch, SyncState, TaxonomyList, UnifiedSearch } from './types';

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
/**
 * URL của endpoint ingest (web tự kéo phim từ vsmov rồi gửi về đây). Tách riêng
 * vì `useVsmov` cần nó mà không được import cả cinemaApi vào module đó.
 */
export const apiIngestUrl=`${apiBaseUrl}/ingest/movies`;
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

const rawBaseQuery=fetchBaseQuery({baseUrl:apiBaseUrl});
type QueryResult=Awaited<ReturnType<typeof rawBaseQuery>>;

/**
 * Trả lời bằng request đã bắn trước từ `index.html`, nếu có một cái khớp.
 *
 * Nhờ nó mà trang chủ và trang xem không phải chờ trọn một round-trip *sau khi*
 * bundle về: câu hỏi đã đi từ lúc trình duyệt đọc HTML. `null` nghĩa là không có
 * gì dùng được — mọi nhánh lỗi đều trả `null` để đường thường chạy nguyên vẹn.
 *
 * URL do `bootUrl()` dựng, không dựng lại ở đây: nó là *một nửa* của phép so khớp
 * với chuỗi mà index.html nối bằng tay, nên phải nằm cạnh `claimBoot` để test đo
 * được cả hai nửa cùng lúc.
 */
async function fromBoot(args:string|FetchArgs):Promise<QueryResult|null>{
  if(typeof args!=='string'&&args.method&&args.method!=='GET')return null;
  const reply=claimBoot(bootUrl(apiBaseUrl,args));
  if(!reply)return null;
  try{
    const raw=await reply;
    // Đúng hình dạng của fetchBaseQuery với responseHandler mặc định: mọi 2xx
    // (kể cả 202 "đang nhập phim") vào `data`, còn lại vào `error` kèm body.
    const data=raw.text?JSON.parse(raw.text):null;
    return raw.ok?{data}:{error:{status:raw.status,data}};
  }catch{
    // Mạng chết, hoặc body không phải JSON (rewrite trả về index.html chẳng
    // hạn): để đường thường sinh ra đúng cái lỗi mà app vẫn quen giải thích.
    return null;
  }
}

/**
 * Câu trả lời cho "cho tôi phim này". `movie:null` + `importing` nghĩa là API đang
 * kéo phim về ở nền và request này không chờ — đây là hình dạng làm cho việc điều
 * hướng không còn phải xếp sau việc đồng bộ dữ liệu.
 */
export interface MovieResponse{movie:Movie|null;importing?:ImportJob|null}

/**
 * Nhặt lại request đã bắn trước từ `index.html` (`fromBoot`), rồi đi đường thường.
 * Nguồn phim duy nhất là VSMOV nên không còn `?source=` hay ghi nhận nguồn trả lời.
 */
const baseQuery:BaseQueryFn<string|FetchArgs,unknown,FetchBaseQueryError>=async(args,api,extra)=>{
  const result=(await fromBoot(args))??(await rawBaseQuery(args,api,extra));
  return result;
};

export const cinemaApi=createApi({
  reducerPath:'cinemaApi',
  baseQuery,
  tagTypes:['Movie','Sync','Favorite','Progress','Health'],
  endpoints:(builder)=>({
    getCatalog:builder.query<MovieList,CatalogQuery>({query:({kind,value,...params})=>({url:catalogUrl(kind,value),params})}),
    getTaxonomy:builder.query<TaxonomyList,'genres'|'countries'|'years'|'actors'|'codes'>({query:(kind)=>`/catalog/${kind}`}),
    // Menu điều hướng đổi rất chậm — giữ cache 10 phút để không gọi lại mỗi lần đổi route.
    getNavigation:builder.query<Navigation,void>({query:()=>'/catalog/navigation',keepUnusedDataFor:600}),
    /**
     * Chi tiết một phim. Phim chưa từng nhập thì API trả **202** kèm `importing` —
     * `fetchBaseQuery` coi 202 là thành công, nên body đó về ở `data` chứ không
     * phải `error`, và trang chi tiết vẽ được ngay từ `movie:null` + tiến trình.
     */
    getMovie:builder.query<MovieResponse,string>({query:(slug)=>`/catalog/movies/${encodeURIComponent(slug)}`,providesTags:(_r,_e,slug)=>[{type:'Movie',id:slug}]}),
    getLocalMovies:builder.query<MovieList,{page?:number;limit?:number;q?:string;genre?:string;country?:string;year?:number;type?:string;person?:string;personKind?:'actor'|'director';sort?:string}>({query:(p)=>({url:'/movies',params:{...p,page:p.page??1,limit:p.limit??24}}),providesTags:['Movie']}),
    // Tìm kiếm hợp nhất trên DB: một từ khoá trả về cả phim và người, không dấu.
    searchAll:builder.query<UnifiedSearch,{q:string;page?:number;limit?:number}>({query:({q,...params})=>({url:'/search',params:{q,...params}})}),
    getPeople:builder.query<PersonList,{q?:string;kind?:'actor'|'director';page?:number;limit?:number}>({query:(p)=>({url:'/people',params:{...p,page:p.page??1,limit:p.limit??60}})}),
    getPerson:builder.query<{person:Person}&MovieList,{slug:string;page?:number;kind?:'actor'|'director'}>({query:({slug,...params})=>({url:`/people/${encodeURIComponent(slug)}`,params})}),
    getLocalMovie:builder.query<MovieResponse,string>({query:(slug)=>`/movies/${encodeURIComponent(slug)}`,providesTags:(_r,_e,slug)=>[{type:'Movie',id:`local-${slug}`}] }),
    /**
     * Tiến trình nhập phim. Poll endpoint này chứ không poll lại chính phim: một
     * lần đọc trạng thái trong RAM của API rẻ hơn nhiều lần join phim + tập +
     * người, mà 1.5 giây/lần thì khác biệt đó thành thật.
     */
    getImportStatus:builder.query<{slug:string;importing:ImportJob|null},string>({query:(slug)=>`/import/${encodeURIComponent(slug)}/status`}),
    getEpisode:builder.query<Episode,number>({query:(id)=>`/episodes/${id}`}),
    getHealth:builder.query<{ok:boolean;service:string;time:string},void>({query:()=>'/health',providesTags:['Health']}),
    getSync:builder.query<SyncState,void>({query:()=>'/sync/status',providesTags:['Sync']}),
    startSync:builder.mutation<any,{pages:number}>({query:(body)=>({url:'/sync/start',method:'POST',body}),invalidatesTags:['Sync']}),
    importMovie:builder.mutation<MovieResponse,string>({query:(slug)=>({url:`/import/${encodeURIComponent(slug)}`,method:'POST'}),invalidatesTags:['Movie']}),
    getFavorites:builder.query<{items:Movie[]},void>({query:()=>({url:'/favorites',params:{deviceId}}),providesTags:['Favorite']}),
    getFavorite:builder.query<{favorite:boolean},number>({query:(id)=>({url:`/favorites/${id}`,params:{deviceId}}),providesTags:(_r,_e,id)=>[{type:'Favorite',id}]}),
    setFavorite:builder.mutation<{favorite:boolean},{movieId:number;enabled:boolean}>({query:({movieId,enabled})=>({url:`/favorites/${movieId}`,method:'POST',body:{deviceId,enabled}}),invalidatesTags:(_r,_e,x)=>['Favorite',{type:'Favorite',id:x.movieId}]}),
    saveProgress:builder.mutation<any,{episodeId:number;position:number;duration:number;completed?:boolean}>({query:(body)=>({url:'/watch-progress',method:'POST',body:{...body,deviceId}}),invalidatesTags:['Progress']}),
    getContinue:builder.query<{items:any[]},void>({query:()=>({url:'/continue-watching',params:{deviceId}}),providesTags:['Progress']}),
    /**
     * Tìm phụ đề ở nguồn ngoài. Chỉ gửi `episodeId`: tên phim, năm, imdb/tmdb id và số
     * tập đều nằm trong DB của API, để web tự dựng câu truy vấn là mở đường cho hai
     * phía lệch nhau — và mỗi lần lệch là một lần quota miễn phí bị đốt vô ích.
     */
    searchSubtitles:builder.query<SubtitleSearch,{episodeId:number;lang?:string;query?:string}>({query:({episodeId,...params})=>({url:'/subtitles/search',params:{episodeId,...params}})}),
    // Tải thật thì mới tiêu quota, nên là mutation: không cache, không tự gọi lại.
    fetchSubtitle:builder.mutation<SubtitleFile,{provider:string;id:string}>({query:(body)=>({url:'/subtitles/fetch',method:'POST',body})}),
    /** Dán link .srt/.zip: phải đi qua API vì trình duyệt bị CORS chặn gần hết. */
    fetchSubtitleUrl:builder.mutation<SubtitleFile,{url:string}>({query:(body)=>({url:'/subtitles/remote',method:'POST',body})})
  })
});

export const {useGetCatalogQuery,useGetTaxonomyQuery,useGetNavigationQuery,useSearchAllQuery,useGetPeopleQuery,useGetPersonQuery,useGetMovieQuery,useGetLocalMoviesQuery,useGetLocalMovieQuery,useGetEpisodeQuery,useGetImportStatusQuery,useGetHealthQuery,useGetSyncQuery,useStartSyncMutation,useImportMovieMutation,useGetFavoritesQuery,useGetFavoriteQuery,useSetFavoriteMutation,useSaveProgressMutation,useGetContinueQuery}=cinemaApi;
/** Tìm sub là hành động người xem bấm, không phải dữ liệu của trang → lazy. */
export const {useLazySearchSubtitlesQuery,useFetchSubtitleMutation,useFetchSubtitleUrlMutation}=cinemaApi;
export const {usePrefetch}=cinemaApi;
