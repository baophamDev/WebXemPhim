@echo off
chcp 65001 >nul
setlocal

rem ===========================================================================
rem  Đóng gói app webOS cho TV LG thành file .ipk.
rem
rem    build-ipk.cmd                  -> webos-out\BaoNhanCinema-webOS.ipk
rem    build-ipk.cmd install          -> gói rồi cài lên thiết bị tên "tv"
rem    build-ipk.cmd install mytv     -> gói rồi cài lên thiết bị tên "mytv"
rem
rem  App này là "hosted web app": nó chỉ chứa appinfo.json + hai icon, còn nội dung
rem  nằm trên Vercel (xem "main" trong BaoNhanCinema\appinfo.json). Vì
rem  vậy KHÔNG cần build apps\web ở đây, và sửa web thì chỉ cần `git push` là TV có
rem  bản mới — chạy lại script này chỉ khi đổi id / tên / icon / URL.
rem
rem  Chỉ cần Node 22+; công cụ của LG gọi qua npx nên không phải cài trước (lần đầu
rem  cần mạng để tải, sau đó dùng cache). Trong VS Code, extension webOS Studio bấm
rem  Package / Install ở panel APPS cũng ra đúng file này.
rem ===========================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "APP=%ROOT%\BaoNhanCinema"
set "OUT=%ROOT%\webos-out"
set "IPK_NAME=BaoNhanCinema-webOS.ipk"
set "APP_ID=com.localcinema.tv"

echo.
echo === [1/2] Đóng gói .ipk ===
where node >nul 2>nul || (echo    Không thấy Node. Cài Node 22+ rồi chạy lại. & goto :fail)
if not exist "%APP%\appinfo.json" (
    echo    Không thấy "%APP%\appinfo.json" — kiểm tra lại đường dẫn.
    goto :fail
)
if not exist "%OUT%" mkdir "%OUT%"
del /q "%OUT%\%APP_ID%_*_all.ipk" 2>nul
rem Phải dùng `npx -p`: gói này có nhiều lệnh (ares-package, ares-install...) nên
rem npx không tự đoán được lệnh nào. Không thêm vào package.json là có ý — thêm mà
rem không cập nhật package-lock.json thì `npm ci` trong CI sẽ đổ.
call npx --yes -p @webos-tools/cli ares-package "%APP%" -o "%OUT%"
if errorlevel 1 (
    echo    Thử gói cũ hơn của webOS OSE...
    call npx --yes -p @webosose/ares-cli ares-package "%APP%" -o "%OUT%" || goto :fail
)
set "BUILT="
for %%f in ("%OUT%\%APP_ID%_*_all.ipk") do set "BUILT=%%~ff"
if not defined BUILT (
    echo    Chạy xong nhưng không thấy file .ipk trong "%OUT%".
    goto :fail
)
move /y "%BUILT%" "%OUT%\%IPK_NAME%" >nul || goto :fail
echo.
echo ==========================================================
echo  Xong: %OUT%\%IPK_NAME%
echo ==========================================================

echo.
echo === [2/2] Cài lên TV ===
if /i not "%~1"=="install" (
    echo    Bỏ qua. Chạy "build-ipk.cmd install" để cài luôn.
    echo.
    echo  Lần đầu: bật Developer Mode trên TV, rồi khai báo thiết bị một lần bằng
    echo    npx -p @webos-tools/cli ares-setup-device
    echo  Chi tiết ở docs\webos.md — nhớ cả chuyện phiên Developer Mode hết sau 50 giờ.
    goto :done
)
set "DEVICE=%~2"
if "%DEVICE%"=="" set "DEVICE=tv"
echo    ares-install --device %DEVICE%
call npx --yes -p @webos-tools/cli ares-install --device "%DEVICE%" "%OUT%\%IPK_NAME%" || (
    echo.
    echo  Cài không được. Kiểm tra: TV đã bật Developer Mode chưa, tên thiết bị
    echo  "%DEVICE%" đã khai báo bằng ares-setup-device chưa, và PC có cùng mạng
    echo  với TV không. Xem danh sách: npx -p @webos-tools/cli ares-setup-device --list
    goto :fail
)
echo    Đã cài. Mở app: npx -p @webos-tools/cli ares-launch --device %DEVICE% %APP_ID%

:done
endlocal
exit /b 0

:fail
echo.
echo  *** Dừng lại vì có lỗi ở trên. ***
endlocal
exit /b 1
