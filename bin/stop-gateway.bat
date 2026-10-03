@echo off
taskkill /f /im fbr-gateway.exe >nul 2>&1
echo FBR Gateway stopped.
timeout /t 1 >nul
exit
