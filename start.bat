@echo off
cd /d "%~dp0"
python -m pip install -r requirements.txt -q >nul 2>&1
start /min "" python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
timeout /t 2 >nul
start http://localhost:8000

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
echo   http://%IP%:8000
echo ============================================
echo.
echo (Your PC and iPhone must be on the same WiFi)
echo.
pause
