@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo   SHOPEE AFFILIATE ZALO - BOT REPLY GROUP
echo =======================================================
echo.

echo [1/4] Kiem tra Node.js / npm...
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay Node.js trong PATH.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay npm trong PATH.
  pause
  exit /b 1
)

if not exist .env (
  copy /Y .env.example .env >nul
  echo [OK] Da tao .env tu .env.example
)

if not exist node_modules\zca-js (
  echo [2/4] Lan dau: dang cai dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install that bai.
    pause
    exit /b 1
  )
) else (
  echo [2/4] Dependencies OK.
)

echo [3/4] Bat BOT REPLY + tu dong mo QR.
set ZALO_REPLY_ENABLED=true
set ZALO_OPEN_QR_AUTOMATICALLY=true

rem Neu .env chua co Group ID, bot se khoa vao group DAU TIEN gui tin nhan.
set ZALO_AUTO_LOCK_FIRST_GROUP=true

echo.
echo [QUAN TRONG]
echo - Anh QR se tu mo sau khi duoc tao.
echo - Hay scan bang nick Zalo bot.
echo - Neu .env chua co Group ID, TIN NHAN DAU TIEN phai gui tu GROUP TEST dung.
echo - Sau do bot tu luu Group ID vao .env va bo qua cac group khac.
echo - Khong mo Zalo Web cung tai khoan trong luc bot dang chay.
echo.
echo [4/4] Khoi dong listener...
call npm run zalo:listen

echo.
pause
