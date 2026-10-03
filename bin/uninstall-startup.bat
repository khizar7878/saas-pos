@echo off
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AK_FBR_Gateway" /f >nul 2>&1
taskkill /f /im fbr-gateway.exe >nul 2>&1
echo FBR Gateway removed from Windows Startup and stopped.
timeout /t 2 >nul
exit
