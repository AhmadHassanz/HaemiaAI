@echo off
REM ============================================================
REM  Haemia Research Demo – Start backend with Python 3.12
REM ============================================================
echo.
echo  Starting Haemia Research Demo Backend...
echo =======================================
echo.

cd /d "%~dp0"

set PYTHON=d:\HaemiaAI\backend\python312\python.exe

if not exist "%PYTHON%" (
    echo [ERROR] Python 3.12 not found at %PYTHON%
    echo         Run the setup first.
    pause
    exit /b 1
)

echo Python: %PYTHON%
%PYTHON% --version
echo.
echo Starting server on http://localhost:8000 ...
echo Press Ctrl+C to stop.
echo.

%PYTHON% main.py

pause
