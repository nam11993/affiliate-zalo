@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo   Shopee Affiliate Zalo - READ ONLY LISTENER
echo =======================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay Node.js trong PATH.
  echo Hay dong cua so nay, mo lai sau khi cai Node.js.
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
  echo [INFO] Lan dau: dang cai dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install that bai.
    pause
    exit /b 1
  )
)

set ZALO_REPLY_ENABLED=false

echo.
echo [SAFE MODE] Bot chi DOC tin nhan, KHONG GUI reply.
echo [NOTE] Khong mo Zalo Web cung tai khoan khi listener dang chay.
echo.
call npm run zalo:listen

echo.
pause
