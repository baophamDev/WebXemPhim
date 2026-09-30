@echo off
chcp 65001 >nul
setlocal

rem ===========================================================================
rem  Đóng gói app Android: build web -> nhét vào android/app/src/main/assets/web
rem  -> Gradle -> ra file APK để cài lên điện thoại hoặc Android TV box.
rem
rem    build-apk.cmd                    -> android-out\BaoNhanCinema.apk (API production)
rem    build-apk.cmd install            -> gói rồi cài luôn lên thiết bị đang nối adb
rem    build-apk.cmd lan                -> trỏ vào API chạy trên máy tính này (tự dò IP LAN)
rem    build-apk.cmd lan 192.168.1.20   -> trỏ vào API ở đúng địa chỉ đó
rem    build-apk.cmd api https://x/api  -> trỏ vào một API bất kỳ
rem    build-apk.cmd debug              -> bản debug (mặc định là bản release, có ký)
rem
rem  Toàn bộ phần việc nằm trong scripts\build-apk.mjs — file .cmd này chỉ để gọi
rem  cho tiện và để nói rõ "cần Node". Chạy trực tiếp cũng được:
rem    node scripts\build-apk.mjs --help
rem
rem  Lần đầu chạy sẽ tải Gradle/AGP từ mạng; các lần sau chỉ còn vài giây cho
rem  phần web và phần Gradle. JDK 17 nằm sẵn trong .tools\downloads\jdk17.zip,
rem  script tự giải nén nếu chưa có.
rem ===========================================================================

cd /d "%~dp0"
set "PATH=%~dp0.tools\node;%PATH%"

where node >nul 2>nul || (
    echo    Không thấy Node. Cài Node 22+ hoặc giải nén .tools\node rồi chạy lại.
    goto :fail
)

node "%~dp0scripts\build-apk.mjs" %*
if errorlevel 1 goto :fail

endlocal
exit /b 0

:fail
echo.
echo  *** Dừng lại vì có lỗi ở trên. ***
endlocal
exit /b 1
