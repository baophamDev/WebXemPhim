# App Android (APK) — bản cài trong máy

## Khác gì app TV LG

App TV LG là **hosted web app**: `.ipk` chỉ chứa `appinfo.json` + icon, nội dung
nạp từ Vercel, nên sửa web chỉ cần `git push` (xem [webos.md](webos.md)).

App Android thì ngược lại — **local app**:

- APK chứa luôn bản build của `apps/web` trong `assets/web`, mở là chạy và không
  phụ thuộc Vercel.
- Dữ liệu phim vẫn phải hỏi API. Địa chỉ API đóng cứng lúc đóng gói nhưng **đổi
  được ngay trong app**, không cần build lại APK.
- Muốn đưa bản web mới lên máy đã cài thì phải đóng gói lại APK rồi cài đè;
  không có cơ chế tự cập nhật.

## Cấu trúc

```text
android/
  settings.gradle  build.gradle  gradle.properties
  gradlew  gradlew.bat  gradle/wrapper/   Gradle 8.9
  app/build.gradle                        AGP 8.7.3, minSdk 23, compile/target 35
  app/src/main/AndroidManifest.xml        INTERNET, cleartext cho LAN, LEANBACK
  app/src/main/java/com/localcinema/android/MainActivity.java
  app/src/main/res/                       icon, theme, network_security_config
  app/src/main/assets/web/                (gitignore) bản build apps/web — chép vào lúc đóng gói
build-apk.cmd                             chạy scripts/build-apk.mjs
scripts/build-apk.mjs                     build web -> chép assets -> Gradle -> APK
```

Khoá ký nằm cạnh `settings.gradle`: `android/keystore.jks` + `keystore.properties`
(đều bị gitignore, script tự sinh lần đầu). Android nhận diện app bằng chữ ký chứ
không bằng tên, nên mất hai file này là bản cài mới bị coi như app khác — phải gỡ
bản cũ, và dữ liệu trong app mất theo. Sao lưu riêng là việc của người dùng.

## Công cụ

| Thứ | Ở đâu |
| --- | --- |
| Node 22+ | repo dùng sẵn |
| JDK 17 | `.tools/jdk17`, hoặc `.tools/downloads/jdk17.zip` (script tự giải nén), hoặc `JAVA_HOME` trỏ JDK 17 |
| Android SDK | `ANDROID_HOME` / `ANDROID_SDK_ROOT` / `%LOCALAPPDATA%\Android\Sdk`, cần `platform-tools` (adb) |
| Gradle 8.9 | `.tools/gradle-8.9`, hoặc `android/gradlew(.bat)` |

Gradle 8.9 + AGP 8.7.3 cố ý ghim đúng cặp đã có trong `.tools/`; chạy bằng JDK
23 cài sẵn trên máy là đổ. Muốn lên cặp mới thì sửa cả `android/build.gradle`,
`gradle-wrapper.properties` và ghi chú trong `.tools/`.

## Đóng gói

```text
build-apk.cmd                    -> android-out\BaoNhanCinema.apk (API production Railway)
build-apk.cmd install            -> gói rồi cài luôn lên thiết bị đang nối adb
build-apk.cmd lan                -> API = http://<IP LAN của máy này>:4000/api
build-apk.cmd lan 192.168.1.20   -> API ở đúng địa chỉ đó
build-apk.cmd api https://x/api  -> API bất kỳ
build-apk.cmd debug              -> bản debug thay vì bản release có ký
build-apk.cmd --no-web           -> dùng lại apps/web/dist, không build web lại
build-apk.cmd --device <serial>  -> chọn thiết bị khi adb thấy nhiều máy
```

Sáu bước: kiểm tra công cụ -> build `apps/web` với `VITE_API_URL` đã chọn -> chép
`apps/web/dist` vào `android/app/src/main/assets/web` -> đảm bảo khoá ký -> Gradle
`assembleRelease` (hoặc `assembleDebug`) -> chép ra `android-out`.

`build-apk.cmd` chỉ chạy trên Windows (nó gọi `cmd.exe` và dùng đường dẫn kiểu
`D:\...`). Máy khác thì tự chép assets rồi chạy `./gradlew` trong `android/` — CI
làm đúng như vậy ở job **Build APK (Android)**: dựng bản *debug* (runner không có
khoá ký), để trong artifact `BaoNhanCinema-apk` cho người tải về cài thử. Bản đó
không phải bản phát hành, và job này không chặn deploy web/API.

Cài thủ công:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r android-out\BaoNhanCinema.apk
```

Với TV box: bật "Gỡ lỗi ADB", `adb connect <ip>:5555` rồi cài như trên. Hoặc chép
file `.apk` vào máy và mở bằng trình quản lý file.

## Đổi máy chủ API ngay trong app

Không cần build lại APK. Hai lối vào cùng một hộp thoại:

- nút **Máy chủ** trên header — chỉ hiện khi trang chạy trong app Android;
- giữ nút **Back** khoảng 1 giây.

Giá trị lưu trong `SharedPreferences` (`bao-nhan-cinema` / `api-base`). Lần nạp
sau, vỏ không trả `index.html` nguyên bản mà chèn
`<script>window.__API_BASE__=…</script>` ngay sau `<head>`, trước khối script bắn
request đón trước — nhờ vậy cả request đón trước trong `index.html` lẫn bundle
(`apps/web/src/api.ts`) đều đi theo địa chỉ mới, và giá trị này thắng
`VITE_API_URL` đóng cứng lúc build. Xoá trống ô nhập là quay về mặc định.

Mặc định lấy từ `BuildConfig.DEFAULT_API_BASE`: API production trên Railway, trừ
khi đóng gói với `api …` hoặc `lan`.

Xem kho trong nhà: chạy `npm run dev` trên máy tính (API nghe `0.0.0.0:4000`),
trong app đổi máy chủ thành `http://<IP LAN>:4000/api`. Điện thoại phải cùng mạng
WiFi, và firewall Windows phải cho cổng 4000 ở mạng Private.

## Vì sao nội dung chạy dưới https://appassets.androidplatform.net

Nạp `index.html` bằng `file://` thì origin là opaque (`null`): localStorage bị
chặn, request tới API thành cross-origin kỳ quặc. Nên vỏ giữ nguyên bản build
trong APK và tự trả nó qua `shouldInterceptRequest()` dưới một host https không
tồn tại thật — chỉ WebView biết — cho lại một origin bình thường: secure context,
localStorage, cookie, giống hệt bản trên Vercel.

Hai hệ quả:

- API phải cho origin này qua CORS — `services/api/src/server.ts` có nhánh riêng
  cho `https://appassets.androidplatform.net`.
- API trong nhà chạy `http://` (không TLS) nên `network_security_config.xml` mở
  cleartext; thiếu nó WebView chặn trước cả CORS và app chỉ hiện "API ngoại tuyến".

## Trên Android TV

Manifest khai cả `LAUNCHER` (điện thoại) lẫn `LEANBACK_LAUNCHER` (Android TV), và
`touchscreen required=false` để box không cảm ứng vẫn cài được. Vỏ tự thêm
`CinemaTV/1` vào UA; web thấy dấu đó thì bật lớp điều khiển TV — cần đến UA vì
`?tv=1` chỉ sống ở lần nạp đầu, sang trang phim rồi tải lại là mất.

Thử giao diện TV ngay trên điện thoại:

```powershell
adb shell am start -n com.localcinema.android/.MainActivity --ez tv true
```

Nút Back đi theo thứ tự: lùi lịch sử SPA -> thoát fullscreen -> đóng app ở gốc;
giữ Back khoảng 1 giây thì mở hộp thoại đổi máy chủ.

## Xử lý lỗi thường gặp

### Trong app hiện "API ngoại tuyến" dù API vẫn sống

1. API phải nghe `0.0.0.0` (mặc định) chứ không phải `127.0.0.1`.
2. Điện thoại và máy tính cùng mạng; địa chỉ phải là IP LAN
   (`http://192.168.x.x:4000/api`) — `localhost` trong app là chính chiếc điện thoại.
3. Mở `http://<IP LAN>:4000/api/health` bằng trình duyệt điện thoại; không mở
   được thì thường là firewall Windows (cho cổng 4000 ở mạng Private là đủ).

### Cài đè báo "App not installed" / "Ứng dụng chưa được cài đặt"

Chữ ký khác nhau: bản debug (CI) và bản release (`build-apk.cmd`) ký bằng hai khoá
khác nhau, máy khác sinh khoá cũng vậy. Gỡ bản cũ rồi cài lại — dữ liệu trong app
(máy chủ đã chọn, chủ đề, lịch sử xem) mất theo, nhớ đổi máy chủ lại.

### Gradle đổ ngay khi mới chạy

Gần như luôn là sai JDK: cần đúng JDK 17. Bước 1 của `build-apk.cmd` in ra dòng
`JDK:` với đường dẫn thật đang dùng — so với bảng công cụ ở trên.

### APK trắng trang sau khi cài đè

Bản web trong APK cũ hơn `index.html` mà WebView còn nhớ. Vỏ đặt
`Cache-Control: no-store` cho nội dung trong APK để tránh đúng ca này; nếu vẫn
gặp, gỡ app rồi cài lại.
