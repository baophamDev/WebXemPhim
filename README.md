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
services/api/             Backend Express
services/api/src/db.ts    Kết nối PostgreSQL
services/api/src/providers/ Lớp thay thế nguồn catalog
supabase/migrations/      Schema PostgreSQL
railway.json              Cấu hình deploy Railway
vercel.json               Cấu hình deploy Vercel
```

Nguồn catalog mặc định là VSMOV. Database dùng hai trường `provider` và `provider_id`, vì vậy có thể thêm nguồn khác mà không cần đổi schema.

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
3. Chọn **Transaction pooler** hoặc chế độ pooler tương đương.
4. Sao chép chuỗi URI. Chuỗi thường có dạng:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

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
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
DATABASE_SSL=true
DATABASE_POOL_SIZE=10
CATALOG_PROVIDER=vsmov
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
| `CATALOG_PROVIDER` | Provider catalog đang sử dụng |
| `VSMOV_API_URL` | Base URL của provider VSMOV |
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
  "provider": "vsmov",
  "time": "2026-08-17T00:00:00.000Z"
}
```

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
CATALOG_PROVIDER=vsmov
VSMOV_API_URL=https://vsmov.com/api
```

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
npm run build
```

Cả hai lệnh phải kết thúc với exit code `0`.

## 10. Dữ liệu và bảo mật

- Frontend Vercel không kết nối trực tiếp Supabase.
- `DATABASE_URL` chỉ đặt ở Railway hoặc `services/api/.env` trên máy local.
- Không đặt `DATABASE_URL`, database password hoặc Supabase `service_role` key vào biến `VITE_*`.
- Mọi biến bắt đầu bằng `VITE_` đều có thể được đóng gói vào JavaScript và nhìn thấy trong trình duyệt.
- `deviceId` dùng cho yêu thích và lịch sử xem được lưu trong `localStorage` của từng trình duyệt.
- Dự án hiện chưa có đăng nhập người dùng. Xóa dữ liệu trình duyệt sẽ tạo `deviceId` mới.
- CORS chỉ kiểm soát trình duyệt, không phải cơ chế xác thực API. Endpoint đồng bộ hiện vẫn là endpoint công khai nếu ai đó biết URL Railway.

## 11. Thay catalog provider

Provider mới phải triển khai interface tại:

```text
services/api/src/providers/types.ts
```

Sau đó đăng ký provider trong:

```text
services/api/src/providers/index.ts
```

Ví dụ:

```ts
const providers = {
  vsmov,
  myProvider
};
```

Trên Railway, đổi:

```env
CATALOG_PROVIDER=myprovider
```

Database không phụ thuộc tên VSMOV vì phim được xác định bằng `provider` và `provider_id`.

## 12. Xử lý lỗi thường gặp

### Railway báo `DATABASE_URL is required`

Chưa thêm `DATABASE_URL` vào Railway Variables hoặc tên biến bị viết sai. Tên phải viết hoa chính xác.

### Railway không kết nối được Supabase

Kiểm tra:

- Đã dùng Transaction Pooler URI chưa.
- Password có đúng không.
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

## 13. Thứ tự triển khai ngắn gọn

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
