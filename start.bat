@echo off
setlocal
cd /d "%~dp0"
title ReChiplet Setup

echo ========================================
echo ReChiplet Startup
echo Folder: %CD%
echo ========================================
echo.

echo [CHECK] Project files...
if not exist "backend\app\main.py" echo ERROR: Missing backend\app\main.py
if not exist "backend\app\main.py" goto failed
if not exist "frontend\package.json" echo ERROR: Missing frontend\package.json
if not exist "frontend\package.json" goto failed

echo [CHECK] Python...
py -3 -c "import sys; print(sys.version); raise SystemExit(0 if sys.version_info >= (3,11) else 1)"
if errorlevel 1 goto python_failed

echo [CHECK] Node and npm...
node --version
if errorlevel 1 goto node_failed
call npm --version
if errorlevel 1 goto npm_failed

if not exist "backend\.venv\Scripts\python.exe" goto make_venv
goto install_backend

:make_venv
echo [1/5] Creating backend virtual environment...
py -3 -m venv "backend\.venv"
if errorlevel 1 goto venv_failed

:install_backend
echo [2/5] Installing backend dependencies...
call "backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto pip_failed
call "backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 goto requirements_failed

echo [3/5] Applying SQLite migrations...
pushd "backend"
call ".venv\Scripts\python.exe" -m alembic upgrade head
if errorlevel 1 (
  popd
  goto migration_failed
)

echo [4/5] Adding sample data...
call ".venv\Scripts\python.exe" -m app.seed
if errorlevel 1 (
  popd
  goto seed_failed
)
popd

if exist "frontend\node_modules\vite\bin\vite.js" goto start_servers
echo [5/5] Installing frontend packages...
pushd "frontend"
call npm install
if errorlevel 1 (
  popd
  goto frontend_failed
)
popd

:start_servers
echo.
echo Launching backend window...
start "ReChiplet API" cmd /k "cd /d ""%~dp0backend"" && ""%~dp0backend\.venv\Scripts\python.exe"" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
echo Launching frontend window...
start "ReChiplet Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo.
echo Frontend: http://localhost:5173
echo API docs: http://127.0.0.1:8000/docs
echo Leave both server windows open. Press any key to close this launcher.
pause >nul
exit /b 0

:python_failed
echo ERROR: py -3 could not run Python 3.11+.
goto failed
:node_failed
echo ERROR: Node.js is unavailable.
goto failed
:npm_failed
echo ERROR: npm is unavailable.
goto failed
:venv_failed
echo ERROR: Python virtual environment creation failed.
goto failed
:pip_failed
echo ERROR: pip upgrade failed.
goto failed
:requirements_failed
echo ERROR: Backend dependency installation failed.
goto failed
:migration_failed
echo ERROR: Alembic migration failed. Review the error above.
goto failed
:seed_failed
echo ERROR: Demo data seed failed. Review the error above.
goto failed
:frontend_failed
echo ERROR: npm install failed.
goto failed
:failed
echo.
echo Launcher stopped. Copy all text above and send it to ChatGPT.
pause
exit /b 1
