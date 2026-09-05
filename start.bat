@echo off
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
    set "PY_CMD=py -3"
) else (
    set "PY_CMD=python"
)

echo Starting Truck Report local DMS service...
%PY_CMD% -m pip install -r requirements.txt -q
if errorlevel 1 (
    echo.
    echo Could not install or verify the local service requirements.
    echo Make sure Python is installed, then run this file again.
    pause
    exit /b 1
)

start "Truck Report DMS Service" /min %PY_CMD% -m uvicorn main:app --host 0.0.0.0 --port 8765 --reload
timeout /t 2 >nul
start http://localhost:8765

:: Show iPhone / phone access URL
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%
echo ============================================
echo   On your iPhone open Safari and go to:
echo   http://%IP%:8765
echo ============================================
echo.
echo (Your PC and iPhone must be on the same WiFi)
echo.
pause
