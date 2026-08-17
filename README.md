# BảoNhànCinema

Monorepo gồm frontend React/Vite và API Express. Bản production được thiết kế cho:

- Vercel: frontend tĩnh.
- Railway: API stateless.
- Supabase: PostgreSQL bền vững.
- Catalog provider: VSMOV mặc định, có thể thay qua adapter trong `services/api/src/providers`.

## Chạy local

1. Tạo project Supabase và lấy chuỗi **Transaction pooler** trong `Connect`.
2. Sao chép `.env.example` thành `services/api/.env`, sau đó điền `DATABASE_URL`.
3. Từ thư mục gốc chạy:

```powershell
.\start-dev.cmd
```

Frontend chạy tại `http://localhost:5173`, API tại `http://localhost:4000`.
API tự tạo schema khi khởi động. Có thể chạy migration thủ công bằng file `supabase/migrations/202608170001_init.sql` trong Supabase SQL Editor.

## Deploy Railway

1. Tạo service Railway từ repository và giữ Root Directory là thư mục gốc.
2. Railway sẽ đọc `railway.json` để build và start workspace API.
3. Thêm biến môi trường:

```env
DATABASE_URL=postgresql://...
DATABASE_SSL=true
DATABASE_POOL_SIZE=10
CATALOG_PROVIDER=vsmov
VSMOV_API_URL=https://vsmov.com/api
WEB_ORIGIN=https://your-project.vercel.app
HOST=0.0.0.0
```

Không cần tự đặt `PORT`; Railway cung cấp biến này. Sau khi deploy, kiểm tra `https://your-api.up.railway.app/api/health`.

## Deploy Vercel

1. Import cùng repository vào Vercel và giữ Root Directory là thư mục gốc.
2. `vercel.json` build workspace `apps/web` và phục vụ `apps/web/dist`.
3. Thêm biến môi trường cho Production và Preview:

```env
VITE_API_URL=https://your-api.up.railway.app/api
```

4. Sau lần deploy đầu tiên, cập nhật `WEB_ORIGIN` trên Railway bằng domain Vercel thật. Có thể khai báo nhiều origin, phân cách bằng dấu phẩy.

## Supabase

API kết nối trực tiếp tới PostgreSQL bằng `DATABASE_URL`. Không đưa database password, anon key hay service-role key vào Vercel frontend. Với Transaction pooler, driver được cấu hình `prepare: false` để tương thích PgBouncer.

Các bảng chưa bật public RLS policy vì trình duyệt không truy cập Supabase trực tiếp. Quyền truy cập được kiểm soát qua API Railway.

## Thay catalog provider

Provider phải triển khai interface trong `services/api/src/providers/types.ts`, sau đó đăng ký trong `services/api/src/providers/index.ts`. Database lưu `provider` và `provider_id`, nên nguồn mới không cần dùng tên hoặc ID của VSMOV.

Đổi provider bằng biến:

```env
CATALOG_PROVIDER=vsmov
```

API không tự đồng bộ catalog khi khởi động. Dùng nút **Đồng bộ** trong giao diện hoặc gọi `POST /api/sync/start` khi cần.
