@echo off
REM ==============================================================================
REM FBR Local Gateway — Windows Desktop One-Click Terminator
REM ==============================================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5060 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo FBR Local Gateway stopped.
timeout /t 1 >nul
exit
