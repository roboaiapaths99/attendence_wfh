@echo off
echo ===================================================
echo   LogDay WFH Workstation Setup - Starting...
echo ===================================================

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js (v18 or newer) from https://nodejs.org/ first.
    pause
    exit /b
)

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed! Please install Python (v3.10 or newer) from https://www.python.org/ first.
    pause
    exit /b
)

echo.
echo [1/4] Setting up WFH Python Agent Virtual Environment...
cd ../agent
python -m venv venv
call venv\Scripts\activate
python -m pip install --upgrade pip
echo Installing Python dependencies...
pip install -r requirements.txt
cd ../desktop

echo.
echo [2/4] Setting up WFH Desktop GUI dependencies...
echo Installing Node.js packages...
npm install

echo.
echo ===================================================
echo   Setup Complete! You can now use run_wfh.bat
echo ===================================================
pause
