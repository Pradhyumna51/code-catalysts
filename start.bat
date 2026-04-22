@echo off
echo ==========================================
echo   Starting Meeting Hackathon (Full Stack)
echo ==========================================

echo.
echo [1/2] Starting Flask backend on port 5000...
cd /d "%~dp0"
start "Flask Backend" cmd /k "call .\venv\Scripts\activate && python app.py"

echo [2/2] Starting React frontend on port 5173...
cd /d "%~dp0frontend\ai-meeting-notes"
start "React Frontend" cmd /k "npm run dev"

echo.
echo ==========================================
echo   Both servers are starting!
echo   Backend:  http://127.0.0.1:5000
echo   Frontend: http://localhost:5173
echo ==========================================
echo.
echo Open http://localhost:5173 in your browser.
pause
