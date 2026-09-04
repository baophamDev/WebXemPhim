import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { bootUrl, claimBoot } from './boot';
import { noteAnswer, sourceParam } from './source';
import type { CatalogQuery, Episode, ImportJob, InactiveSource, Movie, MovieList, Navigation, Person, PersonList, SourceHealth, SyncState, TaxonomyList, UnifiedSearch } from './types';

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
/** Player cần tự dựng URL playlist (/stream/...) chứ không đi qua RTK Query. */
export {apiBaseUrl};

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

/** Chỉ những đường dẫn thật sự đi ra nguồn ngoài mới cần biết nguồn ưu tiên. */
const NEEDS_SOURCE=/^\/(catalog|provider|import)\b/;

/**
 * Gắn `?source=` vào các request catalog theo nguồn đang chọn.
 *
 * Làm ở đây thay vì ở từng endpoint để không phải nhớ thêm tham số vào 12 chỗ gọi,
 * và để mọi endpoint thêm sau này tự động đúng. Đổi lại thì khoá cache của RTK
 * Query **không** thay đổi theo nguồn (khoá tính từ tham số endpoint, trước khi
 * hàm này chạy) — nên chỗ đổi nguồn phải gọi `cinemaApi.util.resetApiState()`,
 * xem `ui/pickers.tsx`.
 *
 * Dùng query param chứ không phải header riêng: header lạ khiến mọi GET
 * cross-origin phải preflight thêm một request OPTIONS, mà trang chủ gọi cả chục
 * endpoint catalog một lúc.
 *
 * Đây cũng là chỗ ghi lại nguồn **thật sự** trả lời (`noteAnswer`): mọi response
 * catalog đều mang theo `source` của resolver, nên bắt ở một chỗ rẻ hơn nhiều so
 * với việc luồn nó qua props của từng trang.
 *
 * Và là chỗ nhặt lại request đã bắn trước từ `index.html` (`fromBoot`) — phải nằm
 * sau đoạn gắn `?source=` ở trên, vì URL đem đi so khớp là URL cuối cùng.
 */
const baseQuery:BaseQueryFn<string|FetchArgs,unknown,FetchBaseQueryError>=async(args,api,extra)=>{
  const url=typeof args==='string'?args:args.url;
  const external=NEEDS_SOURCE.test(url);
  const source=sourceParam();
  let request=args;
  if(external&&source){
    const next:FetchArgs=typeof args==='string'?{url:args}:{...args};
    next.params={...(next.params as Record<string,unknown>|undefined),source};
    request=next;
  }
  const result=(await fromBoot(request))??(await rawBaseQuery(request,api,extra));
  // Ghi lại cả khi đang `auto` — nhất là khi đang `auto`, vì lúc đó lựa chọn của
  // người dùng không nói được gì về nguồn nào đã trả lời.
  if(external)noteAnswer(result.data);
  return result;
};

export const cinemaApi=createApi({
  reducerPath:'cinemaApi',
  baseQuery,
  tagTypes:['Movie','Sync','Favorite','Progress','Health'],
  endpoints:(builder)=>({
    getCatalog:builder.query<MovieList,CatalogQuery>({query:({kind,value,...params})=>({url:catalogUrl(kind,value),params})}),
    searchCatalog:builder.query<MovieList,{q:string;page?:number;limit?:number;type?:string;status?:string;year?:string}>({query:({q,...params})=>({url:'/catalog/search',params:{q,...params}})}),
    // Trạng thái từng nguồn catalog: nguồn nào đang bị tạm ngừng, lỗi cuối là gì.
    getProviders:builder.query<{sources:SourceHealth[];inactive:InactiveSource[];order:string[]},void>({query:()=>'/providers'}),
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
    getContinue:builder.query<{items:any[]},void>({query:()=>({url:'/continue-watching',params:{deviceId}}),providesTags:['Progress']})
  })
});

export const {useGetCatalogQuery,useSearchCatalogQuery,useGetProvidersQuery,useGetTaxonomyQuery,useGetNavigationQuery,useSearchAllQuery,useGetPeopleQuery,useGetPersonQuery,useGetMovieQuery,useGetLocalMoviesQuery,useGetLocalMovieQuery,useGetEpisodeQuery,useGetImportStatusQuery,useGetHealthQuery,useGetSyncQuery,useStartSyncMutation,useImportMovieMutation,useGetFavoritesQuery,useGetFavoriteQuery,useSetFavoriteMutation,useSaveProgressMutation,useGetContinueQuery}=cinemaApi;
export const {usePrefetch}=cinemaApi;
