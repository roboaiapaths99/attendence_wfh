@echo off
echo ===================================================
echo   Starting LogDay WFH Workstation Monitor...
echo ===================================================

:: Start Python Daemon in background
echo [1/2] Launching Background Python Agent...
start /min "LogDay Python Agent" cmd /c "cd ../agent && venv\Scripts\activate && uvicorn main:app --port 7890"

:: Wait 3 seconds for Python server to boot
timeout /t 3 /nobreak >nul

:: Start Electron Desktop GUI
echo [2/2] Launching Desktop Tracker App...
npm run start
