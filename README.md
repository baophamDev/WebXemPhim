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
supabase/migrations/      Schema PostgreSQL
BaoNhanCinema/            App TV LG (webOS) — nội dung file .ipk
build-ipk.cmd             Đóng gói/cài .ipk lên TV LG
railway.json              Cấu hình deploy Railway
vercel.json               Cấu hình deploy Vercel
```

Nguồn catalog là **một tầng nhiều nguồn có thứ tự ưu tiên** (`CATALOG_SOURCES`), không phải một nguồn duy nhất: nguồn đầu lỗi thì tự rơi xuống nguồn sau, các nguồn web đọc theo slug bổ sung link tập, và các nguồn `metadata` (TMDB, TheTVDB) bồi vào chỗ trống. Người xem đổi được nguồn ưu tiên ngay trên header, xem mục [11](#11-tầng-nguồn-catalog). Database dùng hai trường `provider` và `provider_id`, vì vậy thêm nguồn không cần đổi schema.

Bấm vào một phim chưa từng xem thì trang chi tiết mở ngay, còn việc kéo dữ liệu về chạy ở nền và có thanh tiến trình riêng — mục [12](#12-mở-một-phim-chưa-có-trong-db).

App cho TV LG là **hosted web app**: file `.ipk` chỉ chứa `appinfo.json` + icon, còn nội dung lấy thẳng từ domain Vercel. Nghĩa là sửa web chỉ cần `git push`, không đóng gói lại. Hướng dẫn đầy đủ ở [docs/webos.md](docs/webos.md).

Player dùng trực tiếp link HLS hoặc trang nhúng mà nguồn trả về; API không proxy hay chỉnh sửa playlist, nên request phát không phải đi qua thêm một chặng xử lý.

Trang chủ và trang xem **không chờ bundle JS rồi mới hỏi API**: `index.html` bắn trước request của đúng route đang mở ngay lúc trình duyệt còn đọc HTML, còn chunk trang chi tiết/trang xem được kéo về từ `pointerdown`. Cách làm và những chỗ dễ làm nó im lặng vô hiệu ở [docs/prefetch.md](docs/prefetch.md).

## 2. Những thứ cần chuẩn bị

Trước khi bắt đầu, cần có:

- Repository dự án đã được đẩy lên GitHub.
- Tài khoản Supabase.
- Tài khoản Railway.
- Tài khoản Vercel.
- Node.js 22 trở lên nếu muốn chạy local.

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
WEB_ORIGIN=http://localhost:5173
HOST=0.0.0.0
```

Giải thích:

| Biến | Công dụng |
| --- | --- |
| `DATABASE_URL` | Kết nối PostgreSQL Supabase |
| `DATABASE_SSL` | Bật SSL khi kết nối Supabase |
| `DATABASE_POOL_SIZE` | Số connection tối đa của một API instance |
| `CATALOG_SOURCES` | Danh sách nguồn catalog, **thứ tự là ưu tiên**. Sáu nguồn web dùng slug được bật mặc định sau VSMOV |
| `VSMOV_API_URL` | Base URL của nguồn VSMOV |
| `TMDB_ACCESS_TOKEN` | Token v4 của TMDB. Không có thì dùng `TMDB_API_KEY` (khoá v3); không có cả hai thì nguồn tmdb tự tắt |
| `TMDB_LANGUAGE` | Ngôn ngữ metadata TMDB, mặc định `vi-VN` |
| `TVDB_API_KEY` | Khoá TheTVDB v4. Không đặt thì nguồn tvdb tự tắt |
| `TVDB_PIN` | Chỉ cần cho khoá loại "user-supported" của TheTVDB |
| `TVDB_LANGUAGE` | Ngôn ngữ TVDB, mã ISO 639-2/B ba chữ, mặc định `vie` |
| `TVDB_COUNTRIES` | Các nước mà trang danh sách TVDB gộp lại, mặc định `chn,kor,jpn` |
| `WEB_ORIGIN` | Những frontend domain được phép gọi API bằng trình duyệt |
| `HOST` | Cho phép Railway truy cập Express server |
| `SOURCE_<NAME>_URL` | Tuỳ chọn: thay domain của nguồn web tương ứng khi nguồn đổi địa chỉ |

`CATALOG_PROVIDER` của bản cũ vẫn được đọc nếu chưa có `CATALOG_SOURCES`, nhưng nên đổi sang tên mới.

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
https://bao-nhan-cinema.vercel.app
```

3. Mở website. Ở thời điểm này giao diện có thể xuất hiện nhưng request API có thể bị CORS chặn vì Railway chưa biết domain Vercel.

## 6. Nối CORS giữa Vercel và Railway

Quay lại Railway → **Variables**, đổi `WEB_ORIGIN` thành domain Vercel thật:

```env
WEB_ORIGIN=https://bao-nhan-cinema.vercel.app
```

Nếu muốn cho phép cả website production và local development, phân cách bằng dấu phẩy:

```env
WEB_ORIGIN=https://bao-nhan-cinema.vercel.app,http://localhost:5173
```

Nếu có custom domain:

```env
WEB_ORIGIN=https://baonhancinema.com,https://bao-nhan-cinema.vercel.app,http://localhost:5173
```

Sau khi lưu, Railway sẽ redeploy/restart service. Chờ API health hoạt động lại rồi refresh website Vercel.

Domain phải khớp chính xác giao thức và hostname. Không thêm đường dẫn `/api` vào `WEB_ORIGIN`.

```text
Đúng: https://bao-nhan-cinema.vercel.app
Sai:  https://bao-nhan-cinema.vercel.app/api
Sai:  bao-nhan-cinema.vercel.app
```

## 7. Đồng bộ dữ liệu lần đầu

API không tự đồng bộ catalog khi restart. Điều này tránh Railway tạo tác vụ nặng ngoài ý muốn.

Sau khi frontend kết nối API thành công:

1. Mở trang chủ BảoNhànCinema.
2. Tìm khối trạng thái **Dữ liệu local**.
3. Chọn **Đồng bộ**.
4. Chờ trạng thái chuyển từ `running` sang `completed`.
5. Kiểm tra bảng `movies` và `episodes` trong Supabase Table Editor.

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

## 8. Chạy local với Supabase

### 8.1. Tạo file môi trường backend

Tại thư mục gốc dự án, chạy PowerShell:

```powershell
Copy-Item .env.example services/api/.env
```

Mở `services/api/.env` và thay `DATABASE_URL` bằng Transaction Pooler URL thật.

Giữ cấu hình local:

```env
PORT=4000
HOST=0.0.0.0
WEB_ORIGIN=http://localhost:5173
DATABASE_SSL=true
DATABASE_POOL_SIZE=5
CATALOG_SOURCES=vsmov,motchillu,motchillv,phim4k,phimmoichill,phimmoichill-win,vieflix,tmdb,tvdb
VSMOV_API_URL=https://vsmov.com/api
```

Chạy local không có khoá TMDB/TVDB vẫn được: nguồn thiếu khoá tự tắt kèm một dòng cảnh báo ở console (`[catalog] bỏ qua nguồn tvdb: thiếu TVDB_API_KEY`), phần còn lại của web chạy bình thường. Nút **Nguồn phim** trên header hiện nguồn đó ở dạng mờ kèm lý do.

`VITE_API_URL` không bắt buộc khi chạy local vì Vite proxy `/api` sang `http://localhost:4000`.

### 8.2. Cài và chạy

Nếu repository chưa có `node_modules`:

```powershell
npm install
```

Chạy cả frontend và backend:

```powershell
.\start-dev.cmd
```

Hoặc:

```powershell
npm run dev
```

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
types.ts      Hợp đồng CatalogSource + các kiểu dữ liệu chuẩn
normalize.ts  Chuẩn hoá + kiểm tra shape ở biên, khớp phim giữa hai nguồn
http.ts       fetch dùng chung: timeout, cache theo TTL
resolver.ts   Chọn nguồn, fallback, circuit breaker, bồi metadata
vsmov.ts      Nguồn playable (có link tập)
web.ts        Sáu nguồn web playable, đọc trang phim theo slug
tmdb.ts       Nguồn metadata (không có link tập)
tvdb.ts       Nguồn metadata thứ hai (TheTVDB v4, mạnh về phim bộ châu Á)
index.ts      Đăng ký nguồn, đọc CATALOG_SOURCES
```

Hai loại nguồn khác nhau ở chỗ được phép trả gì:

| Loại | Ví dụ | Được dùng cho |
| --- | --- | --- |
| `playable` | vsmov, các nguồn web slug | VSMOV cung cấp catalog; các nguồn web bổ sung link tập theo slug |
| `metadata` | tmdb, tvdb | Chỉ lấp chỗ trống: poster, mô tả, năm, điểm, diễn viên |

MyDramaList (`mdl`) có tên trong bảng nguồn nhưng chưa có adapter — API của họ chưa mở công khai. Nó hiện mờ trong danh sách nguồn kèm lý do thay vì bị giấu đi, vì một danh sách thiếu tên trông như lỗi.

Mọi method trong `CatalogSource` đều **optional**. Resolver hỏi `typeof source.byGenre === 'function'` trước khi gọi, nên một nguồn chỉ có `search` vẫn đăng ký được — nó chỉ đơn giản là bị bỏ qua ở những khả năng nó không có.

### 11.1. Cách resolver chọn nguồn

1. Lọc ra các nguồn có khả năng đang cần, theo đúng thứ tự `CATALOG_SOURCES`.
2. Nguồn nào đang bị circuit breaker mở thì bị đẩy xuống cuối, không bị loại — hết nguồn thì vẫn thử nó.
3. Gọi lần lượt. Kết quả phải qua `zod` mới được nhận; sai shape bị tính là lỗi của nguồn đó.
4. Nguồn lỗi 3 lần liên tiếp thì bị tạm ngừng 30 giây, nhân đôi mỗi lần lỗi tiếp, tối đa 10 phút. Không có bước này thì mỗi request phải đợi hết 20 giây timeout của nguồn chết trước khi sang nguồn sau.
5. Hết mọi nguồn mới trả lỗi, và thông điệp lỗi kể tên từng nguồn cùng lý do.

Riêng `detail()` đi xa hơn: ưu tiên nguồn playable **có tập**, rồi bồi các field còn `null` từ những nguồn còn lại và dừng ngay khi đã đủ. Nguồn metadata không bao giờ ghi đè field mà nguồn playable đã có — phim nào nguồn nào phát thì nguồn đó là sự thật về tên, tập, chất lượng.

Hai nguồn đặt slug khác nhau cho cùng một phim, nên khi slug không khớp, resolver tìm lại bằng tên + năm (`matchScore`, ngưỡng `0.72`) và ghi nhớ cặp slug đó. Dưới ngưỡng thì coi như không tìm thấy — thà thiếu metadata còn hơn gán poster của phim khác.

### 11.2. Thêm một nguồn

Viết adapter export một object `CatalogSource`, dùng `getJson` của `http.ts` và các helper của `normalize.ts` để trả đúng shape:

```ts
export const mySource: CatalogSource = {
  name: 'mysource',
  kind: 'playable',
  async search(keyword, page = 1, limit = 24) { /* ... */ },
  async detail(slug) { /* ... */ }
};
```

Đăng ký trong `providers/index.ts`:

```ts
const AVAILABLE: Record<string, Entry> = {
  vsmov: { source: vsmov, kind: 'playable', enabled: true, hint: '' },
  tmdb: { source: tmdb, kind: 'metadata', enabled: tmdbEnabled, hint: 'thiếu TMDB_ACCESS_TOKEN hoặc TMDB_API_KEY' },
  tvdb: { source: tvdb, kind: 'metadata', enabled: tvdbEnabled, hint: 'thiếu TVDB_API_KEY' },
  mysource: { source: mySource, kind: 'playable', enabled: Boolean(process.env.MYSOURCE_API_URL), hint: 'thiếu MYSOURCE_API_URL' }
};
```

`enabled: false` không xoá tên nguồn khỏi `GET /api/providers` — nó vào danh sách `inactive` kèm `hint`, và web hiện mờ kèm lý do. Nguồn đã đặt tên nhưng chưa có adapter thì để `source: null` (đó là chỗ của `mdl`).

Rồi đổi biến môi trường trên Railway:

```env
CATALOG_SOURCES=mysource,vsmov,tmdb,tvdb
```

Tên nguồn không có trong `AVAILABLE` sẽ làm API dừng ngay lúc khởi động — sai chính tả biến môi trường phải vỡ ồn ào, không im lặng chạy thiếu nguồn.

Database không phụ thuộc tên nguồn vì phim được xác định bằng `provider` và `provider_id`.

### 11.3. Xem nguồn nào đang sống

```text
GET /api/providers
```

```json
{
  "sources": [
    { "name": "vsmov", "kind": "playable", "capabilities": ["home", "search", "detail"], "healthy": true, "failures": 0, "openUntil": null, "lastError": null, "lastSuccessAt": "2026-09-04T10:29:58.000Z" },
    { "name": "tvdb", "kind": "metadata", "capabilities": ["home", "search", "detail"], "healthy": false, "failures": 3, "openUntil": "2026-09-04T10:31:00.000Z", "lastError": "Nguồn tvdb trả HTTP 401 (kiểm tra khoá API trong biến môi trường)", "lastSuccessAt": null }
  ],
  "inactive": [
    { "name": "mdl", "kind": "metadata", "hint": "MyDramaList chưa mở API công khai — cần xin khoá ở mydramalist.com/api_request" }
  ],
  "order": ["vsmov", "motchillu", "motchillv", "phim4k", "phimmoichill", "phimmoichill-win", "vieflix", "tmdb", "tvdb"]
}
```

`healthy: false` nghĩa là đang bị tạm ngừng, không phải nguồn đã chết hẳn; `openUntil` là lúc nó được thử lại.

`inactive` là những nguồn có tên nhưng chưa dùng được (thiếu khoá, chưa có adapter), kèm `hint` nói thiếu gì.

### 11.4. Đổi nguồn ưu tiên cho một request

`CATALOG_SOURCES` là thứ tự mặc định của server. Từng request đổi được thứ tự đó:

```text
GET /api/catalog/home?source=tvdb
GET /api/catalog/search?q=dien%20hy&source=tmdb
```

hoặc bằng header `x-catalog-source: tvdb` cho script và curl.

Đây là **ưu tiên, không phải khoá cứng**: nguồn được chọn chỉ nhảy lên đầu hàng, mọi bước fallback ở 11.1 vẫn nguyên. Ba tính chất đi kèm, mỗi cái đổi lấy một lỗi đã gặp:

- Trong `detail()`, nguồn `playable` vẫn được hỏi trước nguồn `metadata` kể cả khi đang chọn một nguồn metadata. Không có luật này thì chọn `tmdb` là tự tay tắt nút play, vì nguồn metadata không có link tập.
- Tên nguồn không nằm trong danh sách đang bật thì trả `400` và kể tên các nguồn đang bật, không im lặng bỏ qua. Sai chính tả một lần rồi ngồi hỏi vì sao đổi nguồn không có tác dụng thì tốn thời gian hơn nhiều.
- Mọi response catalog đều mang thêm `source` — **nguồn đã thật sự trả lời**, không phải nguồn được chọn:

```json
{ "items": [], "pagination": {}, "source": "vsmov" }
```

Trên web, nút **Nguồn phim** ở header làm đúng việc này (`apps/web/src/source.ts`): lựa chọn được nhớ trong `localStorage`, gắn vào mọi request catalog, và nút hiện luôn nguồn đang trả lời. Chọn `tvdb` rồi mở trang chủ vẫn thấy `vsmov` trả lời là chuyện bình thường — TVDB không có mục "phim mới cập nhật" — nên nút chấm màu hổ phách để nói ra chuyện đó thay vì để người dùng tin là mình đang xem dữ liệu TVDB.

Đổi nguồn ở web sẽ xoá sạch cache của RTK Query. Khoá cache được tính từ tham số endpoint **trước khi** `?source=` được gắn vào, nên không xoá thì đổi nguồn xong vẫn thấy y nguyên dữ liệu cũ.

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

Mở Railway deployment logs. API chỉ bắt đầu listen sau khi kết nối database và tạo schema thành công, nên lỗi database sẽ làm health check thất bại.

### Website Vercel báo `Failed to fetch`

Kiểm tra:

1. `VITE_API_URL` có kết thúc bằng `/api` không.
2. API health Railway có mở được trực tiếp không.
3. `WEB_ORIGIN` có đúng domain Vercel và không chứa `/api` không.
4. Sau khi sửa biến Vercel, đã redeploy frontend chưa. Biến `VITE_*` được đóng vào lúc build nên sửa biến mà không redeploy sẽ chưa có tác dụng.

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
9. Refresh frontend và chạy đồng bộ 1–3 trang.
10. Kiểm tra dữ liệu trong Supabase.
