/**
 * Chế độ sáng/tối.
 *
 * Ba lựa chọn, không phải hai: `system` là mặc định vì máy của người dùng đã có câu
 * trả lời (điện thoại tự chuyển tối buổi tối), và ép sáng hay ép tối trái với cài
 * đặt máy là việc web không nên tự làm.
 *
 * Chủ đề được đặt vào `document.documentElement.dataset.theme` **ngay khi module
 * này được nạp**, trước cả lần render đầu của React. Nếu đợi một `useEffect` thì
 * trang sáng lên bằng màu tối rồi nhảy sang màu sáng — cái nháy đó nhìn như lỗi và
 * chói mắt hơn hẳn việc để nguyên tối.
 *
 * CSS đọc `:root[data-theme='light']`; `color-scheme` cũng được đặt theo để thanh
 * cuộn, ô nhập và menu gốc của trình duyệt đi cùng màu với trang.
 */
export type Theme='dark'|'light'|'system';

const KEY='cinema-theme';
const THEMES:Theme[]=['dark','light','system'];

function read():Theme{
  try{
    const saved=localStorage.getItem(KEY) as Theme|null;
    return saved&&THEMES.includes(saved)?saved:'system';
  }catch{
    return 'system';
  }
}

let choice=read();
const listeners=new Set<()=>void>();
const media=typeof window!=='undefined'&&typeof window.matchMedia==='function'
  ?window.matchMedia('(prefers-color-scheme: light)')
  :null;

/** Chủ đề thật sự đang hiển thị: `system` quy về sáng/tối theo cài đặt máy. */
export function activeTheme():Exclude<Theme,'system'>{
  if(choice!=='system')return choice;
  return media?.matches?'light':'dark';
}

export function themeChoice(){return choice;}

function paint(){
  const root=document.documentElement;
  const active=activeTheme();
  root.dataset.theme=active;
  // `color-scheme` phải khớp, không thì thanh cuộn tối nằm cạnh trang sáng.
  root.style.colorScheme=active;
}

export function setTheme(next:Theme){
  choice=THEMES.includes(next)?next:'system';
  try{
    if(choice==='system')localStorage.removeItem(KEY);
    else localStorage.setItem(KEY,choice);
  }catch{/* không nhớ được thì thôi, vẫn đúng trong lần mở này */}
  paint();
  for(const listener of listeners)listener();
}

export function subscribeTheme(listener:()=>void){
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}

if(typeof document!=='undefined'){
  paint();
  // Đang ở `system` mà người dùng đổi cài đặt máy thì trang đổi theo, không cần tải lại.
  media?.addEventListener('change',()=>{
    if(choice!=='system')return;
    paint();
    for(const listener of listeners)listener();
  });
}
