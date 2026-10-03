@echo off
REM ==============================================================================
REM FBR Local Gateway — Windows Desktop One-Click Launcher
REM ==============================================================================

set "POS_DIR=%~dp0\.."
if exist "%POS_DIR%\scripts\local-fbr-proxy.mjs" goto found

set "POS_DIR=%USERPROFILE%\Documents\React\ak-retail-pos"
if exist "%POS_DIR%\scripts\local-fbr-proxy.mjs" goto found

set "POS_DIR=%USERPROFILE%\Desktop\ak-retail-pos"
if exist "%POS_DIR%\scripts\local-fbr-proxy.mjs" goto found

set "POS_DIR=C:\ak-retail-pos"
if exist "%POS_DIR%\scripts\local-fbr-proxy.mjs" goto found

echo Error: Could not locate ak-retail-pos directory.
echo Please keep this file in ak-retail-pos\scripts\ or check your folder location.
pause
exit /b 1

:found
cd /d "%POS_DIR%"

REM Check if already running on port 5060
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5060 ^| findstr LISTENING') do (
    echo FBR Local Gateway is ALREADY running on port 5060 (PID %%a).
    timeout /t 2 >nul
    exit /b 0
)

echo Starting FBR Local Gateway on Port 5060...
start "" /b node scripts/local-fbr-proxy.mjs > "%TEMP%\fbr-local-proxy.log" 2>&1
timeout /t 2 >nul

curl -s -m 3 http://localhost:5060/api/health >nul
if %ERRORLEVEL% equ 0 (
    echo =======================================================
    echo   FBR Local Gateway is ONLINE (Domestic Pakistan IP)
    echo   Port: 5060
    echo =======================================================
) else (
    echo Could not verify local gateway on port 5060.
    echo Check log at: %TEMP%\fbr-local-proxy.log
)
timeout /t 2 >nul
exit
