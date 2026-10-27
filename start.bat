@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Install Python 3.11+ and enable PATH.& pause & exit /b 1)
where node >nul 2>nul || (echo Install Node.js 20+.& pause & exit /b 1)
if not exist "backend\.venv\Scripts\python.exe" py -3.11 -m venv backend\.venv
if errorlevel 1 (echo Python 3.11 launcher unavailable. Try py -m venv backend\.venv manually.& pause & exit /b 1)
call backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (pause & exit /b 1)
pushd backend
call .venv\Scripts\python.exe -m alembic upgrade head
call .venv\Scripts\python.exe -m app.seed
popd
if not exist "frontend\node_modules" (pushd frontend & call npm install & popd)
start "ReChiplet API" cmd /k "cd /d ""%~dp0backend"" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
start "ReChiplet Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo Frontend http://localhost:5173 ^| API docs http://127.0.0.1:8000/docs
endlocal
