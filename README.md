# BảoNhànCinema

BảoNhànCinema là website xem phim cá nhân gồm ba thành phần:

```text
Trình duyệt
    |
    v
Vercel: React/Vite frontend
    |
    v
Railway: Express API
    |
    v
Supabase: PostgreSQL database
```

Sau khi deploy, máy tính cá nhân không cần bật liên tục. Vercel phục vụ giao diện, Railway chạy API và Supabase lưu dữ liệu.

## 1. Cấu trúc dự án

```text
apps/web/                 Frontend React/Vite
apps/web/public/tv/       Lớp điều khiển TV (D-pad, phím remote LG)
apps/web/src/source.ts    Nguồn phim đang chọn + nguồn đã trả lời
apps/web/src/theme.ts     Chế độ sáng/tối/theo máy
apps/web/src/boot.ts      Nhặt lại request mà index.html đã bắn trước
apps/web/src/chunks.ts    Chunk nạp lười + hâm nóng trước khi bấm
services/api/             Backend Express
services/api/src/db.ts    Kết nối PostgreSQL
services/api/src/http.ts  Vỏ bọc route: bắt lỗi async, Cache-Control cho route chỉ đọc
services/api/src/importer.ts Hàng đợi nhập phim chạy ở nền
services/api/src/providers/ Tầng nguồn catalog (nhiều nguồn, có fallback)
scripts/local-db.mjs      Cụm PostgreSQL local, `npm run dev` tự bật
scripts/wait-for-api.mjs  Đợi API mở cổng rồi mới mở Vite
supabase/migrations/      Schema PostgreSQL
BaoNhanCinema/            App TV LG (webOS) — nội dung file .ipk
build-ipk.cmd             Đóng gói/cài .ipk lên TV LG
android/                  App Android (APK) — vỏ WebView, bản web nằm trong APK
build-apk.cmd             Đóng gói/cài .apk lên điện thoại hoặc Android TV box
railway.json              Cấu hình deploy Railway
vercel.json               Cấu hình deploy Vercel
```

Nguồn catalog có ba tầng: **VSMOV là nguồn chính, KKPhim (`phimapi.com`) thay thế khi VSMOV lỗi, trả rỗng hoặc hết luồng phát, NguonC (`phim.nguonc.com`) bồi tập embed khi cả hai nguồn kia đều không có luồng phát** (VSMOV đang trả `link_m3u8` rỗng ở mọi tập), xem mục [11](#11-tầng-nguồn-catalog). Menu thể loại là **hợp** của các nguồn, nên thể loại chỉ có ở NguonC (Tâm Lý, Tình Cảm, Miền Tây...) vẫn hiện và bấm được. Database dùng hai trường `provider` và `provider_id`, vì vậy thêm nguồn không cần đổi schema.

Bấm vào một phim chưa từng xem thì trang chi tiết mở ngay, còn việc kéo dữ liệu về chạy ở nền và có thanh tiến trình riêng — mục [12](#12-mở-một-phim-chưa-có-trong-db).

App cho TV LG là **hosted web app**: file `.ipk` chỉ chứa `appinfo.json` + icon, còn nội dung lấy thẳng từ domain Vercel. Nghĩa là sửa web chỉ cần `git push`, không đóng gói lại. Hướng dẫn đầy đủ ở [docs/webos.md](docs/webos.md).

App cho Android thì ngược lại: **app cài trong máy** (local app) — APK chứa luôn bản build của `apps/web`, mở là chạy và không phụ thuộc Vercel. Dữ liệu phim vẫn phải lấy từ API, và API đó đổi được ngay trong app: mặc định là Railway, muốn xem kho trong nhà thì trỏ sang API chạy trên máy tính (không cần build lại APK). Hướng dẫn đầy đủ ở [docs/android.md](docs/android.md).

Player dùng trực tiếp link HLS hoặc trang nhúng mà nguồn trả về; API không proxy hay chỉnh sửa playlist, nên request phát không phải đi qua thêm một chặng xử lý.

Trang chủ và trang xem **không chờ bundle JS rồi mới hỏi API**: `index.html` bắn trước request của đúng route đang mở ngay lúc trình duyệt còn đọc HTML, còn chunk trang chi tiết/trang xem được kéo về từ `pointerdown`. Cách làm và những chỗ dễ làm nó im lặng vô hiệu ở [docs/prefetch.md](docs/prefetch.md).

## 2. Những thứ cần chuẩn bị

Trước khi bắt đầu, cần có:

- Repository dự án đã được đẩy lên GitHub.
- Tài khoản Supabase.
- Tài khoản Railway.
- Tài khoản Vercel.
- Node.js 22 trở lên nếu muốn chạy local.
- PostgreSQL 14 trở lên nếu muốn chạy local mà không cần Supabase — dev dùng cụm
  trong `.tools/pgdata`, xem mục 8.1.

Không đưa password database hoặc chuỗi `DATABASE_URL` vào GitHub.

## 3. Tạo database trên Supabase

### 3.1. Tạo project

1. Đăng nhập Supabase Dashboard.
2. Chọn **New project**.
3. Chọn organization và đặt tên project, ví dụ `bao-nhan-cinema`.
4. Tạo một database password mạnh và lưu lại password này.
5. Chọn region gần nơi Railway sẽ chạy, ví dụ Singapore nếu có.
6. Chờ Supabase tạo project hoàn tất.

### 3.2. Tạo bảng

Cách dễ kiểm tra nhất là chạy migration thủ công:

1. Trong Supabase Dashboard, mở **SQL Editor**.
2. Chọn **New query**.
3. Mở file [supabase/migrations/202608170001_init.sql](supabase/migrations/202608170001_init.sql) trong repository.
4. Sao chép toàn bộ nội dung file vào SQL Editor.
5. Chọn **Run**.
6. Mở **Table Editor** và kiểm tra đã có các bảng:

```text
movies
episodes
movie_genres
movie_countries
movie_people
favorites
watch_progress
sync_state
```

Migration có thể chạy lại an toàn vì sử dụng `CREATE TABLE IF NOT EXISTS` và `ON CONFLICT DO NOTHING`.

API Railway cũng tự kiểm tra/tạo schema khi khởi động. Chạy migration thủ công vẫn được khuyến nghị vì bạn sẽ thấy lỗi database sớm hơn.

### 3.3. Lấy DATABASE_URL chính xác

1. Trong Supabase Dashboard, chọn **Connect**.
2. Tìm phần connection string dành cho PostgreSQL.
3. Chọn **Session pooler** (port 5432) hoặc **Transaction pooler** (port 6543). Chuỗi URI có dạng:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

Port 5432 là session pooler (mỗi kết nối một session — đúng cách `postgres.js` của API này dùng). Port 6543 là transaction pooler; dùng được nhưng chuẩn bị statement đơn giản và một số lệnh DDL/migration có thể gặp giới hạn.

5. Thay phần password bằng database password đã tạo ở bước 3.1.

Phải dùng URI PostgreSQL, không dùng các giá trị sau thay cho `DATABASE_URL`:

- Supabase Project URL dạng `https://xxxxx.supabase.co`.
- `anon` key.
- `service_role` key.
- REST API URL.

Nếu password chứa ký tự đặc biệt như `@`, `#`, `/`, `?` hoặc `:`, cần URL-encode password. Cách đơn giản nhất là tạo password chỉ gồm chữ cái và số, hoặc dùng công cụ URL encoder đáng tin cậy.

## 4. Deploy API lên Railway

Nên deploy Railway trước Vercel vì frontend cần URL của API.

### 4.1. Tạo Railway service

1. Đăng nhập Railway.
2. Chọn **New Project**.
3. Chọn **Deploy from GitHub repo**.
4. Chọn repository BảoNhànCinema.
5. Nếu Railway hỏi Root Directory, để ở thư mục gốc repository, không chọn riêng `services/api`.

Railway sẽ đọc [railway.json](railway.json) và sử dụng:

```text
Install: Nixpacks tự chạy npm install/ci
Build: npm run build --workspace services/api
Start: npm run start --workspace services/api
Health check: /api/health
```

### 4.2. Thêm biến môi trường Railway

Trong Railway service, mở **Variables** và thêm từng biến:

```env
# Pooler (không dùng db.<ref>.supabase.co — IPv6-only, Railway không nối được).
# Project ở region nào thì dùng region đó (vd ap-northeast-1 = Tokyo).
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
DATABASE_POOL_SIZE=10
VSMOV_API_URL=https://vsmov.com/api
KKPHIM_API_URL=https://phimapi.com
NGUONC_API_URL=https://phim.nguonc.com/api
WEB_ORIGIN=http://localhost:5173
HOST=0.0.0.0
```

Giải thích:

| Biến | Công dụng |
| --- | --- |
| `DATABASE_URL` | Kết nối PostgreSQL Supabase |
| `DATABASE_SSL` | Bật SSL khi kết nối Supabase |
| `DATABASE_POOL_SIZE` | Số connection tối đa của một API instance |
| `VSMOV_API_URL` | Base URL của nguồn VSMOV (nguồn chính) |
| `KKPHIM_API_URL` | Base URL của KKPhim, mặc định `https://phimapi.com` (nguồn thay thế khi VSMOV chết) |
| `NGUONC_API_URL` | Base URL của NguonC, mặc định `https://phim.nguonc.com/api` (nguồn bồi tập embed khi hai nguồn kia không có luồng phát) |
| `WEB_ORIGIN` | Những frontend domain được phép gọi API bằng trình duyệt |
| `HOST` | Cho phép Railway truy cập Express server |

Không tự tạo biến `PORT`. Railway tự cung cấp `PORT` cho ứng dụng.

Ở lần deploy đầu tiên chưa có domain Vercel nên tạm để:

```env
WEB_ORIGIN=http://localhost:5173
```

### 4.3. Tạo public domain cho API

1. Mở **Settings** hoặc **Networking** của Railway service.
2. Chọn tạo public domain, thường là **Generate Domain**.
3. Railway sẽ cấp URL tương tự:

```text
https://bao-nhan-cinema-api-production.up.railway.app
```

Ghi lại URL này. Không thêm `/api` khi lưu URL gốc, nhưng khi cấu hình frontend sẽ dùng:

```text
https://bao-nhan-cinema-api-production.up.railway.app/api
```

### 4.4. Kiểm tra Railway API

Mở URL sau trong trình duyệt:

```text
https://bao-nhan-cinema-api-production.up.railway.app/api/health
```

Kết quả đúng có dạng:

```json
{
  "ok": true,
  "service": "bao-nhan-cinema-api",
  "sources": ["vsmov", "tmdb"],
  "time": "2026-08-17T00:00:00.000Z"
}
```

Muốn biết nguồn nào đang sống, nguồn nào đang bị tạm ngừng thì gọi `/api/providers`.

Nếu health check không hoạt động, chưa nên deploy Vercel. Xem phần xử lý lỗi ở cuối README.

## 5. Deploy frontend lên Vercel

### 5.1. Import repository

1. Đăng nhập Vercel.
2. Chọn **Add New → Project**.
3. Import cùng repository GitHub.
4. Để Root Directory ở thư mục gốc repository.

[vercel.json](vercel.json) đã khai báo:

```text
Build: npm run build --workspace apps/web
Output: apps/web/dist
```

Không cần sửa Framework Preset nếu Vercel đọc đúng cấu hình trong repository.

### 5.2. Thêm URL Railway

Trước khi deploy, mở **Environment Variables** và thêm:

```env
VITE_API_URL=https://bao-nhan-cinema-api-production.up.railway.app/api
```

Thay domain ví dụ bằng domain Railway thật của bạn.

Chọn áp dụng biến cho:

- Production.
- Preview nếu muốn kiểm tra các preview deployment.
- Development nếu sử dụng Vercel CLI.

Không thêm dấu `/` ở cuối URL. Giá trị đúng kết thúc bằng `/api`:

```text
Đúng: https://example.up.railway.app/api
Sai:  https://example.up.railway.app
Sai:  https://example.up.railway.app/api/
```

### 5.3. Deploy và lấy domain frontend

1. Chọn **Deploy**.
2. Sau khi build thành công, Vercel cấp domain tương tự:

```text
https://xemphimhoi.vercel.app
```

3. Mở website. Ở thời điểm này giao diện có thể xuất hiện nhưng request API có thể bị CORS chặn vì Railway chưa biết domain Vercel.

## 6. Nối CORS giữa Vercel và Railway

Quay lại Railway → **Variables**, đổi `WEB_ORIGIN` thành domain Vercel thật:

```env
WEB_ORIGIN=https://xemphimhoi.vercel.app
```

Nếu muốn cho phép cả website production và local development, phân cách bằng dấu phẩy:

```env
WEB_ORIGIN=https://xemphimhoi.vercel.app,http://localhost:5173
```

Nếu có custom domain:

```env
WEB_ORIGIN=https://baonhancinema.com,https://xemphimhoi.vercel.app,http://localhost:5173
```

Sau khi lưu, Railway sẽ redeploy/restart service. Chờ API health hoạt động lại rồi refresh website Vercel.

Domain phải khớp chính xác giao thức và hostname. Không thêm đường dẫn `/api` vào `WEB_ORIGIN`.

```text
Đúng: https://xemphimhoi.vercel.app
Sai:  https://xemphimhoi.vercel.app/api
Sai:  bao-nhan-cinema.vercel.app
```

## 7. Đồng bộ dữ liệu lần đầu

API không tự đồng bộ catalog khi restart. Điều này tránh Railway tạo tác vụ nặng ngoài ý muốn.

Nút **Đồng bộ** trên web đang tạm bỏ, nên việc đồng bộ gọi thẳng endpoint (endpoint
vẫn công khai như trước, xem mục [10](#10-dữ-liệu-và-bảo-mật)):

1. Gọi `POST /api/sync/start` với thân `{"pages":3}`.
2. Chờ trạng thái chuyển từ `running` sang `completed`.
3. Kiểm tra bảng `movies` và `episodes` trong Supabase Table Editor.

Có thể gọi trực tiếp bằng PowerShell:

```powershell
$body = @{ pages = 3 } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/sync/start" `
  -ContentType "application/json" `
  -Body $body
```

Kiểm tra trạng thái:

```powershell
Invoke-RestMethod "https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/sync/status"
```

Không nên đồng bộ quá nhiều trang ngay lần đầu. Bắt đầu với 1–3 trang để kiểm tra database và mức sử dụng Railway/Supabase.

## 8. Chạy local

### 8.1. Database: mặc định là PostgreSQL tại chỗ

`npm run dev` tự bật một cụm PostgreSQL nằm trong `.tools/pgdata` (đã có trong
`.gitignore`) ở cổng `55432`, dùng binary PostgreSQL đã cài trên máy — không cần
Docker, không cần tài khoản Supabase, không đụng tới service PostgreSQL nào khác
đang chạy ở cổng 5432. Script `scripts/local-db.mjs` lo việc đó:

```powershell
npm run db:start     # tạo cụm lần đầu, bật lên, tạo database "cinema"
npm run db:status    # đang chạy hay không
npm run db:stop      # tắt cụm (dữ liệu vẫn còn trong .tools/pgdata)
```

Muốn xoá sạch dữ liệu dev thì tắt cụm rồi xoá thư mục `.tools/pgdata`; lần chạy
sau sẽ tạo lại từ đầu. Cần PostgreSQL 14 trở lên; nếu script không tìm thấy bản
cài, đặt biến `PGBIN` trỏ tới thư mục `bin` của nó.

`services/api/.env` đã trỏ sẵn vào cụm đó:

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/cinema
DATABASE_SSL=false
```

Không cần SSL vì database nằm cùng máy — để `DATABASE_SSL=true` là PostgreSQL
local từ chối kết nối. Khi `DATABASE_URL` trỏ về `localhost`/`127.0.0.1`, API tự
hiểu là không dùng SSL kể cả khi quên đặt biến.

### 8.2. Chạy với Supabase thật (tuỳ chọn)

Production dùng Supabase, còn local thì không bắt buộc. Muốn dev thẳng vào
Supabase, thay `DATABASE_URL` trong `services/api/.env` bằng pooler URL thật và
đặt `DATABASE_SSL=true`:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
```

Lúc đó `npm run dev` tự bỏ qua cụm local (script thấy URL không trỏ về máy này).

### 8.3. Cài và chạy

Tại thư mục gốc dự án, chạy PowerShell:

```powershell
npm install
```

Nếu chưa có `services/api/.env`, `npm run dev` tự tạo nó từ `.env.example` (bản
mẫu đã trỏ sẵn vào cụm PostgreSQL local) — không cần copy tay.

Chạy cả frontend và backend:

```powershell
.\start-dev.cmd
```

Hoặc:

```powershell
npm run dev
```

`npm run dev` chạy theo thứ tự: bật database local (`predev`), dựng API, đợi
`/api/health` trả lời rồi mới mở Vite — nhờ vậy log không còn
`AggregateError [ECONNREFUSED]` do web hỏi API trước khi API kịp `listen()`.
`VITE_API_URL=/api` trong `apps/web/.env` đi qua proxy của Vite sang
`http://127.0.0.1:4000` (xem `apps/web/vite.config.ts`).

Địa chỉ local:

```text
Frontend: http://localhost:5173
API:      http://localhost:4000
Health:   http://localhost:4000/api/health
```

## 9. Kiểm tra trước khi push/deploy

Chạy tại thư mục gốc:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

`typecheck`, `test` và `build` phải kết thúc với exit code `0`. `npm test` chạy bộ test của tầng nguồn catalog (resolver, các adapter HTML theo slug, TMDB, TheTVDB), của hàng đợi nhập phim, của header cache (`services/api/test/http.test.js`) và của phép khớp URL bắn trước (`apps/web/test/boot.test.mjs`) — tất cả trên dữ liệu tự dựng, không cần mạng, khoá API hay database. Adapter nào cần khoá thì test tự đặt khoá giả và thay `globalThis.fetch`, nên CI không có bí mật nào vẫn chạy đủ.

`npm run lint` dùng ESLint 9 với cấu hình ở [eslint.config.mjs](eslint.config.mjs) — một file cho cả hai workspace. Cảnh báo (`warn`) không làm lệnh thất bại, chỉ lỗi (`error`) mới. `npm run lint:fix` sửa những gì sửa được tự động.

Lint là dependency mới, nên lần đầu phải chạy `npm install` ở thư mục gốc một lần để cập nhật `package-lock.json`; nếu push trước khi làm việc đó, bước `npm ci` trên CI sẽ fail vì lock không khớp `package.json`.

## 10. Dữ liệu và bảo mật

- Frontend Vercel không kết nối trực tiếp Supabase.
- `DATABASE_URL` chỉ đặt ở Railway hoặc `services/api/.env` trên máy local.
- Không đặt `DATABASE_URL`, database password hoặc Supabase `service_role` key vào biến `VITE_*`.
- Mọi biến bắt đầu bằng `VITE_` đều có thể được đóng gói vào JavaScript và nhìn thấy trong trình duyệt.
- API không trả message của lỗi hạ tầng ra client. `connect ECONNREFUSED 127.0.0.1:5432` hay tên bảng trong lỗi Postgres chỉ đi vào log Railway; client nhận một câu chung kèm mã `ref` để đối chiếu log. Luật ở [services/api/src/errors.ts](services/api/src/errors.ts).
- `/api/health` chỉ hiện lý do ngắn khi DB lỗi (`không phân giải được tên miền`, `sai mật khẩu database`) vì đây là endpoint công khai.
- `deviceId` dùng cho yêu thích và lịch sử xem được lưu trong `localStorage` của từng trình duyệt.
- Dự án hiện chưa có đăng nhập người dùng. Xóa dữ liệu trình duyệt sẽ tạo `deviceId` mới.
- CORS chỉ kiểm soát trình duyệt, không phải cơ chế xác thực API. Endpoint đồng bộ hiện vẫn là endpoint công khai nếu ai đó biết URL Railway.

## 11. Tầng nguồn catalog

Tất cả nguồn nằm ở `services/api/src/providers/`:

```text
types.ts      Kiểu dữ liệu chuẩn (ListPage/Taxonomy/SourceDetail) + bộ lọc
normalize.ts  Chuẩn hoá + kiểm tra shape ở biên (zod) + khớp tên giữa các nguồn
http.ts       fetch dùng chung: timeout, cache theo TTL
vsmov.ts      Nguồn chính (vsmov.com/api)
kkphim.ts     Nguồn thay thế (phimapi.com — KKPhim, cùng gốc OPhim CMS)
nguonc.ts     Nguồn bồi tập embed + menu thể loại (phim.nguonc.com — NguonC, API OPhim kiểu mới)
index.ts      Resolver: VSMOV trước, KKPhim sau, NguonC cuối, gắn `source` vào kết quả
```

Vì sao có ba nguồn: VSMOV chặn IP datacenter (Railway từng bị 403) và từ 2026-09 trả `link_m3u8` rỗng ở mọi tập — embed chỉ còn player giả nên bấm vào tập là màn hình đen. KKPhim có `link_m3u8` thật và trả `Access-Control-Allow-Origin: *`. NguonC thì ngược lại: **không có m3u8 ở bất kỳ tập nào** (đã quét 20 phim), chỉ có embed thật (`embed*.streamc.xyz`), nên nó là chốt cuối bồi tập cho phim mà hai nguồn kia không phát được. Lưu ý embed `streamc.xyz` có `X-Frame-Options: SAMEORIGIN` và chặn Cloudflare với IP datacenter — đây là embed cho trình duyệt người dùng, không phải luồng để server tải hộ.

Menu thể loại không lấy nguyên của một nguồn: `catalog.genres()` hỏi như mọi danh mục rồi **hợp thêm bản chép tay `nguoncGenres`** (NguonC không có endpoint liệt kê — trang chủ của nó viết cứng danh sách trong HTML). Nhờ vậy menu có cả thể loại chỉ NguonC có, và không trắng khi mọi nguồn động cùng chết.

### 11.1. Cách resolver chọn nguồn

Mọi method của `catalog` (`home`, `listBySlug`, `search`, `byGenre`, `byYear`, ...) đi qua `resolve()`:

1. Hỏi VSMOV trước. Lỗi, trả rỗng, hoặc dữ liệu sai shape thì thử KKPhim, rồi tới NguonC.
2. Cả ba đều không có thì ném lỗi cuối cùng; route ở `server.ts` bắt lỗi đó và rơi tiếp xuống DB (`homeWithFallback`, `listWithFallback`, `searchWithFallback`, `taxonomyWithFallback`).
3. Mọi response mang thêm `source` — nguồn **thật sự** trả lời (`vsmov`, `kkphim`, `nguonc`, hoặc `database`):

```json
{ "items": [], "pagination": {}, "source": "kkphim" }
```

KKPhim không có endpoint diễn viên/mã/danh sách năm; NguonC không có endpoint liệt kê thể loại/quốc gia/năm — cả hai adapter trả rỗng ngay để resolver rơi xuống DB, không tốn một request 404. Riêng thể loại thì NguonC có bản chép tay (`nguoncGenres`) và được hợp vào menu, nên không rơi mất.

Riêng `detail()` đi xa hơn: nguồn được chọn phải có **ít nhất một tập kèm `link_m3u8`**. VSMOV trả về nhưng không có luồng phát thì resolver:

1. Thử `/phim/:slug` bên KKPhim (một số slug trùng nhau).
2. Không có thì tìm theo tên (`/tim-kiem`), chỉ nhận khi tên khớp hoặc năm khớp — thà thiếu nguồn phát còn hơn ghép nhầm phim.
3. Tìm được thì dùng bản KKPhim nhưng **giữ slug người dùng mở** làm khoá bản ghi trong DB.
4. KKPhim cũng không có luồng phát thì hỏi NguonC (`/film/:slug`, không khớp thì `/films/search`). NguonC chỉ trả embed, nhưng là embed thật, nên resolver **giữ metadata của nguồn chính và chỉ thay danh sách tập** — NguonC thiếu năm/điểm nên không muốn lấy metadata của nó đè lên.
5. Cả ba đều không có thì trả bản VSMOV (còn metadata + embed) thay vì mất cả trang.

Ngoài ra `respondWithMovie()` trong `server.ts` **tự chữa bản ghi cũ**: phim đã lưu mà không tập nào có `m3u8` (dấu hiệu của bản nhập từ VSMOV trước đây) thì mở một job nhập lại ở nền, chặn theo giờ để phim mà không nguồn nào có luồng thật không bị nhập mãi. Mở lại trang là bản mới đã nằm trong kho.

### 11.2. Thêm một nguồn

Viết adapter export object cùng shape `vsmov`/`kkphim` (xem `kkphim.ts` làm mẫu), thêm vào mảng `PROVIDERS` trong `index.ts` — thứ tự trong mảng là thứ tự ưu tiên. Thêm test stub `globalThis.fetch` như `test/kkphim.test.js`, và thêm biến môi trường base URL vào `.env.example` + mục 4.2 nếu cần đổi domain.

## 12. Mở một phim chưa có trong DB

Trước đây `GET /api/catalog/movies/:slug` gọi thẳng `resolver.detail()` rồi mới trả lời. Phim chưa từng xem thì request đó phải đi qua nhiều nguồn ngoài, mỗi nguồn tới 20 giây timeout — người dùng bấm vào poster và ngồi nhìn một vòng xoay, không biết web còn sống hay không. Sai ở **thứ tự ưu tiên**, không phải ở tốc độ: mở được trang chi tiết là việc gấp, kéo đủ metadata thì không.

Nên route trả lời ngay bằng những gì đã có, và mở một job nhập ở nền ([services/api/src/importer.ts](services/api/src/importer.ts)):

| Tình huống | Mã | Body |
| --- | --- | --- |
| Đã có trong DB | `200` | `{ "movie": { ... } }` |
| Chưa có, job đang chạy | `202` | `{ "movie": null, "importing": { "slug": "...", "stage": "metadata", "source": "tmdb", "elapsedMs": 1840, "error": null } }` |
| Chưa có, job vừa đổ | `502` | `{ "message": "Nguồn vsmov trả HTTP 502" }` |

`202` là **thành công**, không phải lỗi: web vẽ trang chi tiết từ dữ liệu của thẻ phim vừa bấm rồi hiện tiến trình thật của job.

```text
GET /api/import/:slug/status   -> { "slug": "...", "importing": ImportJob | null }
POST /api/import/:slug         -> nhập rồi chờ, trả { "movie": ... } (script nhập tay)
GET /api/catalog/movies/:slug?wait=1
```

`?wait=1` giữ lại hành vi chặn cũ cho curl và những client không biết poll; job đổ thì nó ném lại đúng lỗi gốc (404 phim không tồn tại khác 502 nguồn chết).

`stage` đi qua `queued → playable → metadata → rematch → enrich → saving → ready`. Bốn chặng giữa là các bước thật của resolver, nên thanh tiến trình nói được việc đang làm chứ không phải một con số bịa cho đẹp.

Ba tính chất của hàng đợi, mỗi cái đổi lấy một lỗi đã gặp:

- **Gộp theo slug.** Mười tab cùng mở một phim vẫn là một job. Không có nó, việc poll 1.5 giây/lần sẽ tự nhân bản job cho tới khi nguồn ngoài chặn IP.
- **Trần số job chạy song song** (`MAX_RUNNING = 6`). Job vượt trần nằm ở chặng `queued`. Đây là chỗ duy nhất chặn được việc mở 50 phim liền tay biến thành 50 chuỗi request tới nguồn ngoài.
- **Không giữ rác.** Job đã xong nằm lại 30 giây cho client kịp đọc kết quả rồi bị dọn; job đã đổ bị bỏ ngay khi client đọc, để lần bấm "Thử lại" là một lần nhập thật chứ không phải phát lại lỗi cũ.

Hàng đợi nằm trong RAM của một tiến trình, nên chạy nhiều instance thì mỗi instance có hàng đợi riêng. Chấp nhận được: job chỉ là *tiến trình* của một lần nhập, còn kết quả nằm ở DB dùng chung. Số job hiện tại có trong `GET /api/health` (`imports`).

## 13. Xử lý lỗi thường gặp

### `npm run dev` đầy `AggregateError [ECONNREFUSED]` khi proxy `/api`

Web hỏi API trước khi API kịp mở cổng (Vite sẵn sàng sau ~1s, `tsx watch` còn phải
build). Từ giờ `apps/web` có `predev` đợi `/api/health` trả lời rồi mới mở Vite,
còn proxy trỏ `127.0.0.1:4000` thay vì `localhost:4000` (trên Windows `localhost`
phân giải ra cả `::1`, mà API chỉ listen IPv4 `0.0.0.0`). Nếu vẫn thấy lỗi này,
kiểm tra API có sống không: `Invoke-RestMethod http://127.0.0.1:4000/api/health`.

### `Database init failed (...) tenant/user postgres.<ref> not found`

Pooler của Supabase trả câu này khi **project không còn tồn tại** (đã xoá, hoặc bị
tạm ngưng quá lâu) — không phải lỗi DNS, cũng không phải sai mật khẩu, nên thử
lại bao nhiêu lần cũng vô ích. Từ giờ API nhận ra nhóm lỗi cấu hình này, báo một
dòng rõ ràng rồi chỉ thử lại mỗi 5 phút thay vì spam log:

```text
DATABASE_URL sai cấu hình (project Supabase không tồn tại hoặc đã bị tạm ngưng): ...
  Chạy `npm run db:start` để dùng PostgreSQL local, hoặc sửa DATABASE_URL trong services/api/.env rồi khởi động lại API.
```

Cách sửa: `npm run db:start` để dev bằng PostgreSQL tại chỗ (mục [8.1](#81-database-mặc-định-là-postgresql-tại-chỗ)),
hoặc tạo project Supabase mới rồi dán pooler URL vào `services/api/.env` (mục
[8.2](#82-chạy-với-supabase-thật-tuỳ-chọn)). API vẫn phục vụ catalog trong lúc
chờ, chỉ các tính năng cần DB (yêu thích, xem tiếp, nhập phim) là chưa chạy.

### Railway báo `DATABASE_URL is required`

Chưa thêm `DATABASE_URL` vào Railway Variables hoặc tên biến bị viết sai. Tên phải viết hoa chính xác.

### Railway không kết nối được Supabase

Kiểm tra:

- **Không dùng host `db.<ref>.supabase.co`**: từ 2026 host direct connection của Supabase chỉ còn bản ghi IPv6, trong khi Railway chỉ có egress IPv4 — log sẽ lặp `connect ENETUNREACH ...:5432` mãi mãi. Phải dùng pooler `aws-0-<region>.pooler.supabase.com` (chỉ IPv4).
- Đã dùng Transaction Pooler URI chưa.
- Password có đúng không. Đổi password trong Supabase (Project Settings → Database → Reset database password) thì phải cập nhật lại cả `DATABASE_URL` trên Railway lẫn `.env` local.
- Password có ký tự đặc biệt chưa URL-encode không.
- `DATABASE_SSL=true` đã được đặt chưa.
- Supabase project có đang bị pause không.

### Health check trả 502/503

Mở Railway deployment logs. API mở cổng trước rồi mới nối database ở nền (để
Railway không đánh rớt service trong lúc Supabase ngủ), nên `/api/health` vẫn trả
`200` với `"database": "connecting"` kèm `databaseError` khi DB chưa lên. Log lúc
khởi động mới là chỗ nói rõ nguyên nhân.

### Website Vercel báo `Failed to fetch`

Kiểm tra:

1. `VITE_API_URL` có kết thúc bằng `/api` không.
2. API health Railway có mở được trực tiếp không.
3. `WEB_ORIGIN` có đúng domain Vercel và không chứa `/api` không.
4. Sau khi sửa biến Vercel, đã redeploy frontend chưa. Biến `VITE_*` được đóng vào lúc build nên sửa biến mà không redeploy sẽ chưa có tác dụng.

### API Railway trả `404 Application not found`

Edge của Railway trả đúng câu này khi **không còn service nào đứng sau domain**: project bị xoá, service bị xoá, hoặc credit của trial đã hết. Đây không phải lỗi của web — kiểm tra bằng `curl.exe -s https://<app>.up.railway.app/api/health`, ra `{"status":"error","code":404,"message":"Application not found"}` nghĩa là phải tạo lại service (hoặc nạp credit) rồi trỏ `VITE_API_URL` sang domain mới. Domain đổi thì phải redeploy frontend, vì biến `VITE_*` được đóng vào bundle lúc build.

### Web vẫn xem được phim khi API chết

Catalog không phụ thuộc hoàn toàn vào API: các nguồn trả `Access-Control-Allow-Origin: *` nên **trình duyệt** gọi thẳng được, và [apps/web/src/catalogFallback.ts](apps/web/src/catalogFallback.ts) dịch route catalog của API sang request tương ứng của nguồn khi API không trả lời (lỗi mạng, 404, 5xx, hoặc rewrite trả HTML). Nhờ vậy trang chủ, khám phá, menu, chi tiết phim và trang xem vẫn dựng được.

Thứ tự ở nhánh này là **NguonC trước, VSMOV sau** ([apps/web/src/nguonc.ts](apps/web/src/nguonc.ts)): NguonC có embed thật nên bấm xem là phát, còn VSMOV chỉ dùng được phần chữ (m3u8 rỗng, embed 522). Trang chi tiết và ô tìm kiếm cũng gọi thẳng NguonC ([apps/web/src/useNguonc.ts](apps/web/src/useNguonc.ts)) khi phim chưa có trong kho, hoặc khi bản trong kho vẫn còn tập giả của VSMOV.

Dải "API ngoại tuyến" ở trang chủ chỉ để nói rằng những thứ thuộc *kho* đang không chạy: Lưu phim, Xem tiếp, tìm trong DB, phụ đề, và job nhập phim ở nền. Muốn có lại thì API phải sống (xem mục trên).
### Trình duyệt báo lỗi CORS

Thêm origin đang hiển thị trong lỗi vào `WEB_ORIGIN` trên Railway. Nhiều origin được phân cách bằng dấu phẩy, không có wildcard tự động.

### Refresh một route Vercel bị 404

Kiểm tra repository vẫn có [vercel.json](vercel.json) ở thư mục gốc và Vercel Root Directory cũng là thư mục gốc.

### Supabase có phim nhưng giao diện không hiện

Trang chủ lấy catalog trực tiếp từ provider. Các trang **Kho local**, **Yêu thích** và **Xem tiếp** mới phụ thuộc dữ liệu Supabase. Kiểm tra cả provider API và database API.

### Video HLS không phát và quay lại iframe

Nguồn `m3u8` có thể chặn CORS hoặc hết hạn. Player sẽ tự fallback sang `embedUrl`; lỗi này độc lập với Vercel, Railway và Supabase.

### Đổi nguồn trên header mà dữ liệu vẫn như cũ

Xem nút **Nguồn phim** đang hiện nguồn nào *đang trả lời*. Nguồn được chọn chỉ được hỏi trước; nguồn không có khả năng đang cần (TVDB không có "phim mới cập nhật") hoặc đang bị circuit breaker tạm ngừng thì nguồn khác trả lời, và nút hiện một chấm màu hổ phách để nói ra chuyện đó. Đối chiếu `GET /api/providers` — `healthy: false` kèm `lastError` là lý do thật.

### Nguồn hiện mờ trong danh sách

Nguồn thiếu khoá (`thiếu TVDB_API_KEY`) hoặc chưa có adapter (`mdl`). Thêm khoá vào biến môi trường Railway rồi redeploy API; danh sách nguồn được đọc lúc khởi động.

### Thanh "tải phim" đứng mãi ở `queued`

Đang có 6 job khác chạy (`MAX_RUNNING`), hoặc nguồn ngoài đang treo tới hết 20 giây timeout. `GET /api/health` cho biết số job đang chạy và đang chờ; `GET /api/import/:slug/status` cho biết chặng của đúng phim đó. Job đổ thì thanh tiến trình chuyển sang trạng thái lỗi kèm lý do của nguồn, và lần bấm "Thử lại" mở một job mới.

## 14. Thứ tự triển khai ngắn gọn

Nếu đã hiểu các bước trên, checklist tối thiểu là:

1. Tạo Supabase project.
2. Chạy migration SQL.
3. Lấy Transaction Pooler `DATABASE_URL`.
4. Deploy Railway và thêm biến môi trường.
5. Tạo Railway public domain và kiểm tra `/api/health`.
6. Deploy Vercel với `VITE_API_URL=https://RAILWAY-DOMAIN/api`.
7. Lấy domain Vercel.
8. Cập nhật Railway `WEB_ORIGIN` bằng domain Vercel.
9. Chạy đồng bộ 1–3 trang qua `POST /api/sync/start` (nút **Đồng bộ** trên web đang tạm bỏ).
10. Kiểm tra dữ liệu trong Supabase.
