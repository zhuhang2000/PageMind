@echo off
setlocal

cd /d "%~dp0bridge"
echo Starting AI web assistant bridge...
echo URL: http://127.0.0.1:17777
echo.

node server.js

echo.
echo Bridge stopped. Press any key to close this window.
pause >nul
