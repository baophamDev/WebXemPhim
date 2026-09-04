# Mở trang không phải chờ API

## Cái chậm là round-trip, không phải việc dựng HTML

Trước khi có mấy thứ trong tài liệu này, mở trang chủ đi theo đúng thứ tự sau:

```
HTML về từ edge của Vercel        ~50ms   (nhanh, file tĩnh, gần người dùng)
tải + parse + chạy bundle JS      300-800ms  (TV LG, điện thoại yếu)
React mount, RTK Query gọi API    ← câu hỏi đầu tiên chỉ đi từ đây
API trả lời                       200-900ms  (Railway + nguồn ngoài)
vẽ được nội dung
```

Hai khoản đắt nhất **nối tiếp nhau**: API còn chưa nhận được câu hỏi trong suốt
thời gian bundle đang về. Đó là chỗ mất thời gian thật, không phải việc dựng HTML
— nên câu trả lời không phải là render ở server.

Ba việc dưới đây làm hai khoản đó chạy song song, và cắt luôn khoản thứ hai ở
những cú bấm đoán trước được.

## 1. Bắn request ngay trong lúc trình duyệt còn đọc HTML

`apps/web/index.html` có một khối `<script>` **cổ điển** (không phải
`type="module"`) trong `<head>`. Khác biệt đó là toàn bộ lý do nó tồn tại: script
module bị hoãn tới sau khi parse xong HTML, còn script cổ điển chạy ngay tại chỗ
nó xuất hiện — trước khi trình duyệt tải xong dòng nào của bundle.

Nó đọc `location.pathname`, nhận ra đang mở route nào, rồi gọi API cho đúng route
đó và cất lời hứa vào `window.__BOOT__`:

| Route | Bắn trước |
|---|---|
| `/` hoặc `/index.html` | `/catalog/home?page=1&limit=24` |
| `/movie/:slug` | `/catalog/movies/:slug` |
| `/watch/:slug/:id` | `/episodes/:id` **rồi** `/catalog/movies/:slug` |

Route khác không bắn gì. Danh sách này cố ý ngắn: mỗi request thêm vào đây là một
request giành băng thông với chính cái bundle đang cần về sớm. Trang chủ có năm
dải phim nhưng chỉ dải đầu (hero + "Vừa thêm vào kho") được bắn trước, bốn dải còn
lại nằm dưới màn hình đầu nên chờ thêm vài trăm ms không ai thấy.

Trang xem bắn `/episodes/:id` **trước** `/catalog/movies/:slug` vì thứ tự đó là thứ
tự cần: một dòng episode là đủ để bấm play, còn `/catalog/movies/:slug` phải join
phim + tập + người để dựng tiêu đề và danh sách tập.

`src/boot.ts` là phía nhặt lại, và nó giữ **cả hai** hàm của phép so khớp:
`bootUrl(base, args)` dựng lại đúng URL mà `fetchBaseQuery` sắp gọi, `claimBoot(url)`
tìm trong hàng đợi. `src/api.ts` chỉ gọi `claimBoot(bootUrl(apiBaseUrl, args))` trong
baseQuery — sau đoạn gắn `?source=`, vì URL đem đi so là URL cuối cùng. Để `bootUrl`
ở `api.ts` thì hai nửa của phép so nằm hai file và không test được cùng lúc.

Ba nguyên tắc trong `boot.ts`, đổi là hỏng:

- **So khớp theo dạng chuẩn hoá.** Hai bên dựng URL hai cách khác nhau (nối chuỗi
  bằng tay ở HTML, xếp từ object `params` ở `fetchBaseQuery`), nên `shape()` sắp
  lại thứ tự tham số và gộp dấu `/` lặp trước khi so.
- **Dùng một lần.** Nhặt ra là bỏ khỏi hàng. Giữ lại thì một cú `refetch()` sau đó
  nhận đúng dữ liệu cũ, và người dùng bấm "thử lại" mãi vẫn thấy y nguyên.
- **Quá 30 giây thì thà hỏi lại.** Mở trang rồi đi làm việc khác mười phút, quay
  lại bấm một cú: lúc đó nhặt câu trả lời của mười phút trước là hiển thị dữ liệu
  cũ mà không ai yêu cầu.

Toàn bộ cơ chế là **đầu cơ**. Không khớp, quá cũ, mạng chết, body không phải JSON —
mọi nhánh đều trả `null` và `fetchBaseQuery` chạy như chưa có gì. Hỏng nhất là tốn
thêm một request; không có nhánh nào làm app hiện lỗi mà bình thường nó không hiện.

### Chỗ dễ làm nó im lặng vô hiệu

**`page`/`limit` phải khớp `Home.tsx`.** Script bắn
`/catalog/home?page=1&limit=24`, còn `src/pages/Home.tsx` gọi
`useGetCatalogQuery({ kind: 'home', page: 1, limit: 24 })`. Lệch một con số là URL
khác đi, không nhặt được, và trang chủ lại chờ một round-trip như cũ — **không có
lỗi nào hiện ra**. `apps/web/test/boot.test.mjs` đọc cả hai chỗ và so, nên bây giờ
sửa một bên mà quên bên kia thì CI đỏ.

**Đừng viết `%VITE_API_URL%` trong comment của khối script đó.** Hook thay biến của
Vite chạy trên toàn bộ file HTML bằng regex global, nên nó thay cả trong comment:
trang đã build sẽ có một URL nằm giữa câu tiếng Việt. Không làm hỏng gì lúc chạy
(chỗ nào cũng được thay đúng giá trị), nhưng nó xoá mất dấu hiệu "chỉ có một chỗ
duy nhất đọc biến này" — comment nhắc tên biến thì viết trần `VITE_API_URL`, không
kẹp dấu `%`. Test khoá luôn số lần xuất hiện của token.

Chưa đặt `VITE_API_URL` thì Vite để nguyên chuỗi và cảnh báo; script nhận ra bằng
`base.charAt(0) === '%'` rồi lùi về `/api` — đúng cho dev, vì dev server của Vite
proxy `/api` sang `localhost:4000`.

Kèm theo đó là `<link rel="preconnect">` tới origin của API: DNS + TCP + TLS tiêu
hoá xong trong lúc bundle còn đang về.

## 2. Hâm nóng chunk trước khi cú bấm hạ xuống

`React.lazy` chỉ bắt đầu tải chunk **sau khi** route đã đổi, nên cú bấm nào cũng có
một quãng trống chờ file JS. `pointerdown` xảy ra trước `click` (điều hướng xảy ra
ở mouseup), nên chunk thường về xong trước khi có người nhìn.

`src/chunks.ts` giữ specifier của hai chunk nóng ở một chỗ duy nhất, vì mỗi cái
được nạp từ hai nơi — `App.tsx` khi route đổi, và thẻ phim / link tập lúc
`pointerdown`. Cùng specifier thì bundler gom ra cùng một chunk; viết tay
`import()` ở hai nơi thì sớm muộn lệch đường dẫn, thành hai chunk gần giống nhau mà
không ai thấy gì sai.

- Link sang trang chi tiết (thẻ phim, hero trang chủ, dải "Xem gì nữa") →
  `useWarmDetail()` trong `ui/cards.tsx`: nhớ bản mô tả phim, prefetch
  `getMovie(slug)`, kéo chunk `Detail`.
- Link sang trang xem (mỗi tập, nút "Xem ngay") → `preloadPlayer()`: chunk `Watch`,
  **và** `hls.js` nếu máy này cần tới nó.

`hls.js` nặng hơn cả phần còn lại của trang cộng lại, nên chỉ tải khi trình duyệt
không tự phát được HLS: `canPlayType('application/vnd.apple.mpegurl')` — Safari,
iOS và một phần TV đi nhánh `video.src` nên không cần engine nào.

Cố tình **không** hâm nóng ở `pointerover`: kéo chuột ngang một dải phim là 20 thẻ,
thành 20 job nhập ở nguồn ngoài cho phim không ai định xem.

## 3. Lần mở lại không phải hỏi nữa

Route catalog chỉ đọc đi qua `cachedRoute()` trong `services/api/src/http.ts`:

| Đường | max-age |
|---|---|
| `/catalog/genres`, `/countries`, `/years`, `/codes`, `/navigation` | 600s |
| `/catalog/home`, `/lists/:slug`, `/genres/:slug`, `/countries/:slug`, `/years/:year`, `/codes/:code` | 60s |
| `/catalog/search` | 30s |

`stale-while-revalidate` bằng 5 lần `max-age` là phần đáng giá nhất: hết hạn rồi
thì trình duyệt vẫn vẽ ngay bản cũ và đi lấy bản mới ở nền, nên F5 hay mở lại app
trên TV lúc nào cũng có hình liền.

Header chỉ được gắn **sau khi** dữ liệu đã về. Gắn trước bằng middleware thì
handler ném lỗi vẫn để header nằm nguyên trên response, và một cái 502 nhất thời bị
trình duyệt giữ lại vài phút — lỗi nhất thời thành lỗi dính, bấm thử lại cũng vô
ích. `test/http.test.js` khoá đúng tính chất đó.

`Vary: Origin, x-catalog-source` là bắt buộc: CORS trả
`Access-Control-Allow-Origin` theo origin của người gọi, thiếu `Vary` thì cache
chung có thể đưa lại header của origin khác và trình duyệt chặn.

Ba đường **không** được cache, cố ý: `/catalog/movies/:slug` (có thể trả 202 "đang
nhập", cache lại là đóng băng đúng cái đang chạy — xem mục 12 của README),
`/episodes/:id`, và mọi đường đọc DB của mình (`/movies`, `/search`, `/people`) vì
chúng vốn đã nhanh.

## Vì sao không render ở server

SSR chuyển thời gian chờ **sang trước byte đầu tiên**, chỗ không có gì để nhìn.
Hiện tại trang vẽ khung + skeleton ngay lập tức rồi điền dữ liệu vào; với SSR thì
màn hình trắng cho tới khi server dựng xong HTML, mà server dựng xong lại phải chờ
đúng cái nguồn ngoài đang chậm.

Nói riêng ở bản deploy này:

- Web là file tĩnh trên Vercel, API ở Railway, DB ở Supabase free tier. Supabase
  ngủ thì request đầu tiên mất vài giây. Hiện tại người dùng thấy khung phim cộng
  banner "API ngoại tuyến"; với SSR họ thấy trang lỗi của Vercel.
- Nguồn ngoài có thể treo tới 20 giây. Function trên Vercel Hobby hết hạn ở ~10
  giây, tức là một nguồn chậm biến thành trang 504 chứ không phải trang có skeleton.
- App TV LG là hosted web app trỏ vào đúng URL Vercel này, nên mọi thứ ở trên áp
  dụng y nguyên cho TV — nơi mạng và CPU đều tệ hơn.

Cái mà SSR làm được mà ba việc trên không làm được là hiển thị nội dung ngay ở byte
đầu tiên cho lần mở đầu tiên. Đổi lại là toàn bộ đường lùi khi API chậm hoặc chết.
Với một kho phim gia đình đọc từ nguồn ngoài, đường lùi đáng giá hơn.

## Kiểm chứng

`apps/web/test/boot.test.mjs` (17 test, chạy trong `npm test`) đo đúng chỗ dễ hỏng
nhất: hai nửa của phép so khớp có còn gặp nhau không. Nó cắt khối script ra khỏi
`index.html`, chạy bằng `new Function` với `location`/`fetch`/`localStorage` giả, rồi
hỏi `claimBoot(bootUrl(...))` — `boot.ts` thật, biên dịch tại chỗ bằng
`ts.transpileModule` — đúng như baseQuery của `api.ts` hỏi.

Không mock `bootUrl`: cả giá trị của nó lẫn chuỗi mà HTML nối bằng tay đều phải là
thật, vì cái cần đo chính là khoảng cách giữa hai thứ đó. Cũng vì vậy mà `bootUrl`
nằm trong `boot.ts` chứ không ở `api.ts` — để một test chạm được cả hai nửa.

Những trường hợp được khoá: thứ tự tham số khác nhau, `VITE_API_URL` chưa đặt (lùi
về `/api`), `VITE_API_URL` có dấu `/` lặp ở cuối, đã chọn nguồn (`?source=`) và
`/episodes` cố ý không có nó, `page`/`limit` đọc trực tiếp từ `Home.tsx`, thứ tự tập
trước phim ở trang xem, dùng một lần, quá 30 giây, và route không nằm trong danh
sách thì không bắn gì.

Đã thử làm hỏng để chắc là test bắt được: đổi `limit=24` thành `limit=12` trong
`index.html` → 7 test đỏ; viết `%VITE_API_URL%` vào comment → 1 test đỏ; đảo thứ tự
`/episodes` và `/catalog/movies` ở nhánh trang xem → 2 test đỏ.

`services/api/test/http.test.js` (8 test) lo phần cache: giá trị `Cache-Control`,
`stale-while-revalidate` bằng 5 lần `max-age`, `Vary`, và tính chất quan trọng nhất
— handler ném lỗi thì **không có header cache nào** được gắn.
