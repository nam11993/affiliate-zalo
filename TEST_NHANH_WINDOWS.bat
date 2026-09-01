@echo off
setlocal
cd /d "%~dp0"
echo Dang mo Shopee Short-Link Simulator...
echo Khong can cai Node.js / npm.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0TEST_SHORT_LINK_WINDOWS.ps1"
