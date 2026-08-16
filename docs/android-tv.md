# Android TV APK

## Kiến trúc đề xuất

Tạo project riêng `apps/android-tv` bằng Kotlin, Jetpack Compose for TV và Media3 ExoPlayer. Ứng dụng TV không gọi VSMOV trực tiếp mà dùng backend Express trên PC.

## Màn hình

- Server setup: nhập hoặc tự dò địa chỉ `http://<pc-ip>:4000`.
- Home: hero, mới cập nhật, đánh giá cao và tiếp tục xem.
- Search: bàn phím TV và tìm kiếm local.
- Detail: thông tin, yêu thích, server và tập phim.
- Player: WebView cho `embedUrl` ở bản đầu; Media3 chỉ dùng khi backend có URL HLS được nguồn cho phép.
- Settings: backend URL, device ID, kiểm tra kết nối và xóa cache.

## API contract

- `GET /api/health`
- `GET /api/movies?page=1&limit=24&q=`
- `GET /api/movies/{slug}`
- `GET /api/continue-watching?deviceId=`
- `POST /api/favorites/{movieId}`
- `POST /api/watch-progress`

## Điều hướng remote

- Mọi poster, tập phim và nút lệnh phải focusable.
- D-pad di chuyển theo grid ổn định; focus được viền trắng 3px và phóng tối đa 1.04.
- Back từ player về detail, từ detail về danh sách, không thoát app đột ngột.
- Giữ focus hiện tại khi quay lại màn hình trước.

## Build prerequisites

- Android Studio và Android SDK.
- JDK 17.
- Minimum SDK 23, target SDK theo Android Studio hiện hành.
- Signed release APK hoặc AAB; APK phù hợp để sideload trên Android TV.

## Acceptance

- Cài được bằng `adb install`.
- Kết nối backend qua LAN và báo lỗi rõ khi PC offline.
- Remote điều hướng được toàn bộ UI không cần chuột/cảm ứng.
- Player fullscreen, Back hoạt động, tiến độ xem đồng bộ theo `deviceId`.
