@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo   AFFILIATE ZALO - BOT DEBUG + REPLY
echo =======================================================
echo.

where node >nul 2>nul || (echo [ERROR] Node.js not found & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm not found & pause & exit /b 1)

if not exist .env copy /Y .env.example .env >nul
if not exist node_modules\zca-js (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (pause & exit /b 1)
)

set ZALO_REPLY_ENABLED=true
set ZALO_AUTO_LOCK_FIRST_GROUP=true
set ZALO_OPEN_QR_AUTOMATICALLY=true
set ZALO_DEBUG_EVENTS=true
set ZALO_SELF_LISTEN=false

echo.
echo [TEST CHUAN]
echo 1. Scan QR bang nick BOT.
echo 2. KHONG mo Zalo Web cua nick BOT.
echo 3. Dung MOT NICK ZALO KHAC gui #ping vao group test.
echo 4. Neu listener nhan duoc, terminal se hien [ZALO EVENT].
echo 5. Bot phai reply: @Ten pong.
echo.
call npm run zalo:listen
pause
