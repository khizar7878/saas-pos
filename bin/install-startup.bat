@echo off
REM ==============================================================================
REM Auto-start FBR Gateway on Windows Boot (No clicks required)
REM ==============================================================================

set "EXE_PATH=%~dp0fbr-gateway.exe"

if not exist "%EXE_PATH%" (
    echo Error: fbr-gateway.exe not found in this folder.
    pause
    exit /b 1
)

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AK_FBR_Gateway" /t REG_SZ /d "\"%EXE_PATH%\"" /f >nul 2>&1

echo =======================================================
echo   FBR Gateway registered for Automatic Windows Startup!
echo   It will now start automatically whenever Windows turns on.
echo =======================================================
echo.
echo Starting it right now...
start "" "%EXE_PATH%"
timeout /t 3 >nul
exit
