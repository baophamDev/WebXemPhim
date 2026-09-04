# CI/CD

Pipeline nằm ở `.github/workflows/ci.yml`, chạy trên GitHub Actions.

## Luồng

| Sự kiện | Chạy gì |
|---|---|
| PR vào `main` | `lint` + `build` (typecheck + test + build) |
| Push vào `main` | `lint` + `build`, rồi `deploy-api` + `deploy-web` song song |

Job `build` chạy `npm ci` → `npm run typecheck` → `npm test` → `npm run build` trên Node 22,
và upload `apps/web/dist` làm artifact (giữ 7 ngày) để đối chiếu khi cần.

Job `lint` chạy `npm run lint` (ESLint 9, cấu hình `eslint.config.mjs`) song song với
`build` và **không** chặn deploy: cấu hình ESLint được viết offline nên lần chạy thật đầu
tiên chính là ở đây. Khi job đã xanh một lần, đổi `needs: build` của hai job deploy thành
`needs: [build, lint]` để lint thành cổng chặn thật sự.

Hai job deploy chỉ chạy khi push vào `main` và `build` đã pass. Cả hai dùng
GitHub Environment `production`, nên có thể bật required reviewers trong
*Settings → Environments → production* nếu muốn duyệt tay trước khi deploy.

## Secrets cần khai báo

Khai ở *Settings → Secrets and variables → Actions*. Nếu thiếu, job deploy tương ứng
sẽ log warning và bỏ qua thay vì fail — CI vẫn xanh.

**Railway (API)**

- `RAILWAY_TOKEN` — project token, lấy ở Railway → project → Settings → Tokens.
- Biến `RAILWAY_SERVICE` (Variables, không phải Secrets) — tên service, mặc định `api`.

**Vercel (web)**

- `VERCEL_TOKEN` — Account Settings → Tokens.
- `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID` — có trong `.vercel/project.json` sau khi chạy
  `vercel link` ở máy local.

Biến môi trường build của web (`VITE_API_URL`, ...) khai trong Vercel project settings;
`vercel pull` sẽ kéo về nên không cần nhắc lại trong workflow.

## Quan trọng: tắt auto-deploy phía provider

Railway và Vercel mặc định tự deploy khi thấy commit mới trên `main`. Nếu để nguyên,
mỗi lần push sẽ deploy hai lần (một từ provider, một từ Actions).

- Railway: service → Settings → Source → tắt *Auto Deploy*.
- Vercel: Project → Settings → Git → *Ignored Build Step* đặt `exit 0`, hoặc bỏ kết nối Git.

Nếu muốn giữ auto-deploy của provider thì xoá hai job `deploy-api`/`deploy-web`
và chỉ dùng CI làm cổng chặn lỗi.

## Chạy thử ở local

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

Đây đúng là các bước hai job `lint` và `build` thực hiện.

Lần đầu sau khi thêm lint: chạy `npm install` (không phải `npm ci`) để `package-lock.json`
nhận các devDependency mới của ESLint. Push mà quên bước này thì `npm ci` trên CI fail
ngay ở bước cài dependency của **cả hai** job.

## Việc còn lại sau lần chạy đầu

Hai job deploy cài CLI bằng `@latest` vì chưa xác nhận được version nào đang ổn.
Sau lần deploy thành công đầu tiên, xem log để biết version Railway CLI và Vercel CLI
thực tế rồi pin lại trong workflow — tránh CI vỡ khi CLI ra bản major mới.
