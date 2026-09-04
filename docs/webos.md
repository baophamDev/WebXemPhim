# TV LG (webOS) — gói .ipk

## TV LG không cài được APK

LG chưa bao giờ dùng Android TV. Máy 2014 trở lên chạy **webOS**, trước đó là
NetCast; cả hai đều không đọc được file `.apk`. App của webOS thực chất là một web
app, nên bản này không viết lại gì cả: nó dùng đúng trang web đang chạy trên
Vercel.

## Hosted web app: cái gì nằm ở đâu

App này là **hosted web app** — đúng loại mà wizard của extension webOS Studio
trong VS Code gọi là "Hosted Web App". File `.ipk` cài vào TV chỉ chứa
`appinfo.json` và hai icon; trường `main` là một URL, và WebAppManager của TV mở
URL đó trong WebView của hệ thống.

```
BaoNhanCinema/          <- toàn bộ nội dung file .ipk (~30 KB)
  appinfo.json          main = https://bao-nhan-cinema.vercel.app/
  icon.png              80x80
  largeIcon.png         130x130
  index.html            dự phòng, bình thường không bao giờ được nạp

apps/web/public/tv/     <- lớp điều khiển TV, deploy cùng web lên /tv/*
  tv.css  tv-remote.js  webos.css  webos-keys.js
```

Hệ quả quan trọng nhất: **sửa web thì chỉ cần `git push`**. Vercel deploy, TV mở
app là có bản mới, không đóng gói lại, không cài lại. Chỉ chạy `build-ipk.cmd`
khi đổi id / tên / icon / URL trong `appinfo.json`.

Hệ quả thứ hai: TV nạp đúng bundle production như máy tính, nên **không còn nhánh
build riêng cho TV** nữa. Bản đóng gói cũ nạp `index.html` bằng `file://` (origin
`null`) và phải xử lý bốn thứ — `base: './'`, bundle `iife` +
`inlineDynamicImports`, `HashRouter`, và CORS cho `Origin: null`. Cả bốn đã bỏ.
Thứ duy nhất còn lại vì TV là `build.target: 'es2017'` trong
`apps/web/vite.config.ts`. Trình duyệt webOS là Chromium đóng băng theo đời máy:
webOS 4–5 (2018–2020) là Chromium 68, webOS 6 (2021) là 79, webOS 22 mới lên 87.
Cả 68 và 79 đều dưới mốc Chrome 80 — nơi `?.` và `??` mới có — nên bundle mặc định
làm mấy đời máy đó trắng trang. Hạ target thì esbuild chỉ hạ cú pháp chứ không thêm
polyfill nên bundle gần như không to thêm. Giới hạn cần biết: webOS 1–3 (Chromium
38) thì es2017 **không** cứu được, đời đó chỉ hiểu ES5 và còn chưa nạp được
`<script type="module">` (Chrome 61 mới có) — muốn hỗ trợ thì phải thêm
`@vitejs/plugin-legacy`, không phải đổi target.

`BaoNhanCinema/index.html` giữ lại làm hai việc: hiện một trang tối tử tế khi
mạng chết, và làm đường lùi nếu gặp firmware chặn `main` trỏ ra URL ngoài (xem
mục cuối). Nó `location.replace()` sang đúng URL trong `appinfo.json` — đổi URL
là phải đổi cả hai chỗ.

## Cấu hình app

Đây là các giá trị đang dùng trong `BaoNhanCinema/appinfo.json`, cũng chính là
những gì cần điền nếu chạy lại wizard **webOS Studio → Project → Hosted Web App**.
Thư mục đã có sẵn nên **không cần chạy wizard**; chạy chỉ để tạo mới ra chỗ khác.

| Ô trong wizard   | Giá trị                              |
| ---------------- | ------------------------------------ |
| Project Location | `D:\Coding\web film\WebXemPhim`      |
| Project Name     | `BaoNhanCinema`                      |
| App ID           | `com.localcinema.tv`                 |
| App Version      | `1.0.0`                              |
| App Title        | `BảoNhànCinema`                      |
| Hosted url       | `https://bao-nhan-cinema.vercel.app/`|

Project Location là **gốc repo**, không phải `apps/`, và đó là chủ ý: extension chỉ
mở được một workspace (không hỗ trợ multi-root) và tìm app bằng cách quét
`appinfo.json` trong các thư mục **con trực tiếp** của workspace. Mở gốc repo trong
VS Code là panel APPS thấy `BaoNhanCinema` ngay, kèm nút Package / Install / Run.
Để app ở `apps/webos/BaoNhanCinema` thì extension không thấy gì.

App ID `com.localcinema.tv` phải khớp với `%APP_ID%` trong `build-ipk.cmd` và với
lệnh `ares-launch` / `ares-inspect` bên dưới. Đổi id là đổi cả ba chỗ, và TV coi
đó là app khác nên bản cũ vẫn nằm lại trên máy.

Vài trường trong `appinfo.json` không có trong wizard nhưng nên biết:
`disableBackHistoryAPI: true` để hệ thống khỏi tự gọi `history.back()` chồng lên
phần xử lý phím Back của mình, `resolution: "1920x1080"`, và `bgColor` / `iconColor`
cho màn hình chờ khớp màu app (`#0b0806` / `#ffc53d`).

## Lớp điều khiển TV

Bốn file trong `apps/web/public/tv/` deploy thành `/tv/*` cùng với web. Trang tự
nạp chúng bằng một đoạn script ở **cuối `<body>`** trong `apps/web/index.html`, chỉ
khi phát hiện đang chạy trên TV. Bản đóng gói cũ chèn mấy file này lúc build
(`stage.mjs`) — hosted thì không còn bước build nào để chèn, trang phải tự nạp lấy.

Ba chi tiết trong đoạn loader đó, đổi là hỏng:

- **Đặt ở cuối `<body>`**, không phải trong `<head>`. Lúc này `<head>` đã parse
  xong, nên link CSS thêm vào head nằm *sau* file CSS của Vite và đè được. Để
  trong `<head>` thì `tv.css` chèn trước CSS của app, mọi override focus mất tác
  dụng mà không có lỗi nào.
- **`script.async = false`**. Script chèn bằng JS mặc định chạy ngay khi tải xong,
  không theo thứ tự — mà `webos-keys.js` cần `window.__tv` do `tv-remote.js` tạo
  ra. Cờ này buộc chúng chạy đúng thứ tự chèn.
- **Nhận diện TV** bằng UA (`Web0S` — chữ số 0 — từ webOS 3 trở lên, `NetCast` cho
  máy trước 2014), hoặc `window.PalmSystem` (object webOS bơm vào mọi app đã cài,
  nên vẫn nhận ra khi UA bị đổi), hoặc `?tv=1` trong URL. Máy tính và điện thoại
  không tải thêm byte nào.

Thử trên máy tính: mở web với `?tv=1` rồi bấm mũi tên, focus phải nhảy giữa các ô.
Nhánh này chạy thì `<html>` có thuộc tính `data-tv` — dấu hiệu để soi bằng
`ares-inspect` khi trên TV không có DevTools.

`tv.css` và `tv-remote.js` là phần D-pad dùng chung (trước đây bản Android TV dùng
đúng hai file này); `webos.css` và `webos-keys.js` là phần riêng của LG.

## Điều khiển của LG

`webos-keys.js` chạy sau `tv-remote.js` và dùng lại `window.__tv`, nên nó chỉ thêm
những gì riêng của remote LG:

- **Back** (mã 461): đang fullscreen thì thoát fullscreen, còn history thì lùi,
  hết thì hiện chữ "Bấm Back lần nữa để thoát" và bấm Back lần hai trong 2,5 giây
  sẽ đóng app. Dùng toast tự vẽ chứ không dùng hộp thoại vì hộp thoại phải giành
  focus, mà focus đang thuộc về lưới poster.
- Phím media: play (415), pause (19), stop (413) gọi `__tv.toggle()`; tua nhanh
  (417) và tua lùi (412) gọi `__tv.seek(±10)`.
- **Magic Remote**: khi có `mousemove`, `webos.css` tắt viền focus của D-pad cho
  khỏi rối; bấm phím bất kỳ là bật lại.
- Rời app (`visibilitychange`) thì tạm dừng mọi `<video>`, quay lại
  (`webOSRelaunch`) thì focus lại vào nội dung.

Hàm `atRoot()` quyết định Back nên lùi hay hỏi thoát, và nó xét **cả `pathname` và
`hash`** là có ý: bản hosted dùng `BrowserRouter` nên route nằm ở pathname
(`/phim/abc`), còn nếu sau này lại chạy từ `file://` thì route nằm sau dấu `#` và
pathname là đường dẫn thật trong máy. Đoán sai theo hướng "chưa ở gốc" thì Back lùi
ra khỏi app; đoán sai hướng kia thì Back ở trang con lại đòi thoát app.

## Đóng gói .ipk

Chỉ cần Node 22+. Công cụ của LG gọi qua `npx` nên không phải cài trước (lần đầu
cần mạng để tải, sau đó dùng cache).

```
cd "D:\Coding\web film\WebXemPhim"
.\build-ipk.cmd
```

Tiền tố `.\` là bắt buộc nếu đang ở PowerShell. Kết quả:
`webos-out\BaoNhanCinema-webOS.ipk`. Script **không build `apps/web`** — nội dung
nằm trên Vercel. Trong VS Code, bấm Package ở panel APPS của extension webOS Studio
cũng ra đúng file này.

Đổi API thì không liên quan gì tới `.ipk`: địa chỉ nằm ở biến `VITE_API_URL` trong
project Vercel, đổi rồi deploy lại web là xong.

## Cài lên TV (Developer Mode)

Máy bán lẻ không cài `.ipk` từ USB — phải qua Developer Mode, hoặc đưa app lên LG
Content Store (có kiểm duyệt), hoặc root máy bằng Homebrew Channel của webosbrew.

1. Trên TV: cài app **Developer Mode** từ LG Content Store, mở lên và đăng nhập
   bằng tài khoản LG developer (đăng ký miễn phí ở trang developer của LG — phải
   là tài khoản đã kích hoạt quyền developer, không phải tài khoản xem TV thường).
2. Bật **Dev Mode Status** → TV tự khởi động lại.
3. Mở lại app Developer Mode, bật **Key Server**. App hiện IP của TV và một
   passphrase ngắn (hết hạn sau ít phút, cứ bật lại là có cái mới).

4. Trên PC, khai báo TV một lần — host là IP ở bước 3, port **9922**, user
   **prisoner**:

   ```
   npx -p @webos-tools/cli ares-setup-device
   ```

   Chọn `add`, đặt tên `tv`, điền host/port/user như trên, rồi lấy khoá SSH bằng
   passphrase:

   ```
   npx -p @webos-tools/cli ares-novacom --device tv --getkey
   ```

   `ares-novacom` chỉ có trong CLI chính thức của LG (`@webos-tools/cli`); gói mã
   nguồn mở `@webosose/ares-cli` không có lệnh này — `build-ipk.cmd` chỉ dùng gói
   OSE làm phương án dự phòng cho bước đóng gói.

   Không thích dòng lệnh thì dùng chính extension webOS Studio (panel TARGETS →
   thêm thiết bị), hoặc **webOS Dev Manager** (dev-manager-desktop của webosbrew):
   giao diện đồ hoạ, tự lo khoá, cài `.ipk` và gia hạn phiên.
5. Gói rồi cài luôn (tên thiết bị mặc định là `tv`):

   ```
   .\build-ipk.cmd install
   .\build-ipk.cmd install mytv
   ```
6. Mở app: `npx -p @webos-tools/cli ares-launch --device tv com.localcinema.tv`,
   hoặc tìm **BảoNhànCinema** trong danh sách app trên TV.

Kiểm tra khi cài không được: TV đã bật Developer Mode chưa, tên thiết bị đã khai
chưa (`ares-setup-device --list`), PC và TV có cùng mạng không.

## Phiên Developer Mode hết sau 50 giờ

Đây là giới hạn của LG, không phải của app: mỗi phiên Developer Mode kéo dài **50
giờ**, hết hạn thì TV **đăng xuất và xoá luôn các app đã cài bằng Developer Mode**.
Trong app Developer Mode có nút gia hạn (đặt lại về 50 giờ) — bấm trước khi hết là
app còn nguyên; nhiều người tự động hoá bằng cron hoặc Home Assistant gọi API gia
hạn. Muốn cài vĩnh viễn thì chỉ có hai đường: qua LG Content Store, hoặc root TV.

Nghĩa là: nếu để quá 50 giờ mà không gia hạn, cứ bật lại Developer Mode rồi chạy
lại `.\build-ipk.cmd install`. Bản hosted đỡ ở chỗ đây là lần cài lại **duy nhất**
cần thiết — nội dung web thì `git push` là TV có ngay.

## Ràng buộc của bản hosted

- **Phải có internet lúc mở app.** Không có mạng thì TV chỉ tải được `index.html`
  dự phòng trong `.ipk`. Bản đóng gói cũ ít nhất còn mở được giao diện (dù danh
  sách phim vẫn trống vì cần API).
- **Không dùng được API chạy trên PC trong LAN.** Trang là `https://` nên trình
  duyệt chặn mixed content khi fetch `http://192.168.x.x:4000` — chế độ `API_URL`
  trỏ vào máy tính coi như bỏ, chỉ còn API trên Railway.
- **Không có phần cài đặt trong TV** để đổi máy chủ, và cũng **không gọi vsmov trực
  tiếp** được: mọi request là `fetch` từ trang nên vsmov thiếu
  `Access-Control-Allow-Origin` là chặn ngay. TV luôn cần API của mình đang chạy.
- CORS thì không phải làm gì: origin của TV là `https://bao-nhan-cinema.vercel.app`,
  đã nằm trong nhánh `*.vercel.app` của `services/api/src/server.ts`. Cờ
  `ALLOW_NULL_ORIGIN` ở đó giờ chỉ còn ý nghĩa cho đường lùi packaged bên dưới.
  Nhắc lại cho rõ: **API này không có xác thực** — ai biết URL Railway là gọi được,
  kể cả `POST /api/watch-progress`. Với dữ liệu phim thì chấp nhận được; đừng thêm
  gì riêng tư vào đó mà không thêm token.

## Debug

Bật Web Inspector cho app đang chạy trên TV:

```
npx -p @webos-tools/cli ares-inspect --device tv --app com.localcinema.tv
```

Lệnh in ra một URL, mở bằng Chrome trên PC là xem được console và network.

Phân biệt lỗi theo triệu chứng: app mở ra **trắng trang** thì xem Console — hay gặp
nhất là cú pháp mới quá so với Chromium của máy (kiểm tra `target: 'es2017'` còn
nguyên trong `vite.config.ts`; nếu là TV webOS 3 trở xuống thì es2017 không đủ, xem
mục đầu) hoặc URL trong `main` sai/không tải được. App **chạy nhưng không điều khiển
được bằng D-pad** thì nhánh nhận diện TV không vào: kiểm tra `<html>` có `data-tv`
không, và `/tv/tv-remote.js` có tải về 200 không. App chạy nhưng **danh sách phim
trống** là lỗi phía API: mở tab Network xem request tới `VITE_API_URL` trả về gì.

## Nếu cần quay lại bản packaged

Có firmware chặn app đã cài điều hướng ra URL ngoài. Gặp trường hợp đó thì đổi
`main` trong `appinfo.json` thành `"index.html"`, copy nội dung `apps/web/dist` vào
`BaoNhanCinema/`, rồi gói lại. Nhưng nhớ là bốn ràng buộc của `file://` sẽ quay lại
cùng: `base: './'`, bundle `iife` + `inlineDynamicImports`, `HashRouter`, và CORS
cho `Origin: null` (cờ `ALLOW_NULL_ORIGIN` vẫn còn trong API đúng vì lý do này).
Lịch sử git trước lần migrate này có đủ cấu hình cũ để lấy lại.



