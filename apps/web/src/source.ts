/**
 * Nguồn catalog người dùng đang chọn.
 *
 * Ngữ nghĩa là **ưu tiên**, không phải khoá cứng: tên chọn ở đây được gửi kèm mỗi
 * request catalog (`?source=`), API đưa nguồn đó lên đầu thứ tự rồi vẫn lùi sang
 * nguồn khác nếu nó không trả lời. Chọn TMDB không được phép làm mất nút play —
 * chỉ nguồn `playable` có link phát, nên khoá cứng vào một nguồn metadata là tự
 * tay tắt khả năng xem phim.
 *
 * Vì sao không nằm trong Redux: khoá cache của RTK Query được tính từ tham số của
 * endpoint **trước khi** baseQuery chạy, nên một giá trị lấy từ store ở tầng
 * baseQuery không làm cache khác đi — đổi nguồn mà vẫn thấy dữ liệu nguồn cũ. Cách
 * duy nhất đúng là xoá sạch cache khi đổi (`resetApiState`), và khi đã phải xoá
 * sạch thì giữ giá trị này ở module đơn giản hơn nhiều. Redux vẫn được thông báo
 * qua `useSyncExternalStore` bên dưới nên giao diện vẫn phản ứng.
 */
const KEY='cinema-source';
/** `auto` = dùng đúng thứ tự nguồn của API, không ưu tiên ai. */
export const AUTO='auto';

function read(){
  try{
    const saved=localStorage.getItem(KEY)?.trim().toLowerCase();
    return saved||AUTO;
  }catch{
    // Chặn storage thì vẫn xem được, chỉ mất việc nhớ lựa chọn giữa các lần mở.
    return AUTO;
  }
}

let current=read();
const listeners=new Set<()=>void>();

/** Tên nguồn đang chọn, hoặc `auto`. Dùng ở baseQuery — gọi rất nhiều nên phải rẻ. */
export function currentSource(){return current;}

/** Nguồn để gửi lên API: `auto` thì không gửi gì, để API tự quyết. */
export function sourceParam(){return current===AUTO?null:current;}

export function setSource(name:string|null|undefined){
  const next=name?.trim().toLowerCase()||AUTO;
  if(next===current)return current;
  current=next;
  try{
    if(next===AUTO)localStorage.removeItem(KEY);
    else localStorage.setItem(KEY,next);
  }catch{/* không nhớ được thì thôi, lựa chọn vẫn có hiệu lực trong lần mở này */}
  for(const listener of listeners)listener();
  return current;
}

export function subscribeSource(listener:()=>void){
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}

/**
 * Nguồn đã **thật sự** trả lời lần gần nhất.
 *
 * Ưu tiên không phải là bảo đảm: chọn tvdb rồi mở trang chủ thì vsmov trả lời, vì
 * tvdb không có endpoint "phim mới cập nhật". Nếu giao diện chỉ hiện lựa chọn thì
 * người dùng tưởng mình đang xem dữ liệu tvdb. Mỗi ListPage của resolver đều có
 * kèm `source`, nên baseQuery ghi lại tên đó ở đây và bộ chọn nguồn nói ra.
 *
 * Dùng chung tập listener với lựa chọn nguồn: cùng một component đọc cả hai giá
 * trị, thêm một kênh thông báo nữa chỉ để tách hai chuỗi ký tự là vô ích.
 */
let answered:string|null=null;

export function lastAnswer(){return answered;}

export function noteAnswer(data:unknown){
  const name=(data as {source?:unknown}|null|undefined)?.source;
  if(typeof name!=='string')return;
  const next=name.trim();
  if(!next||next===answered)return;
  answered=next;
  for(const listener of listeners)listener();
}
