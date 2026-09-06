@echo off
REM ============================================================
REM  Haemia Research Demo – Backend setup script
REM  Run this with Python 3.10, 3.11, or 3.12 installed.
REM ============================================================
echo.
echo  Haemia Research Demo – Backend Setup
echo =======================================
echo.

REM --- Check Python version ---
python --version 2>nul
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.10, 3.11, or 3.12
    echo         from https://www.python.org/downloads/
    echo         Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

REM --- Create venv ---
echo [1/4] Creating virtual environment...
cd /d "%~dp0"
if exist venv (
    echo       venv already exists, skipping.
) else (
    python -m venv venv
)

REM --- Activate and install ---
echo [2/4] Installing Python packages (this may take a few minutes)...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt

echo.
echo [3/4] Verifying TensorFlow import...
python -c "import tensorflow as tf; print('    TensorFlow', tf.__version__, 'OK')"
if errorlevel 1 (
    echo [WARN] TensorFlow import failed. Check Python version (need 3.10-3.12).
)

echo [4/4] Verifying model file...
if exist "model\haemia_research_demo.keras" (
    echo       Model file found.
) else (
    echo [ERROR] Model file not found at model\haemia_research_demo.keras
)

echo.
echo =======================================
echo  Setup complete!
echo  Start the backend with:
echo    cd backend
echo    venv\Scripts\activate
echo    uvicorn main:app --reload --host 0.0.0.0 --port 8000
echo =======================================
echo.
pause
