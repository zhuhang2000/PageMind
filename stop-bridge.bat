@echo off
setlocal

set "PORT=17777"
echo Stopping bridge on port %PORT%...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  echo Killing PID %%P
  taskkill /PID %%P /F
)

echo Done.
pause
