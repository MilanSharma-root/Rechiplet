@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo          ReChiplet Launcher
echo ========================================
echo.

rem Prefer Python 3.11, but accept another installed Python 3.11+.
set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 (
    py -3.11 --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=py -3.11"
    if not defined PYTHON_CMD (
        py -3 --version >nul 2>&1
        if not errorlevel 1 (
            py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
            if not errorlevel 1 set "PYTHON_CMD=py -3"
        )
    )
)
if not defined PYTHON_CMD (
    where python >nul 2>nul
    if not errorlevel 1 (
        python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
        if not errorlevel 1 set "PYTHON_CMD=python"
    )
)
if not defined PYTHON_CMD (
    echo ERROR: Python 3.11 or newer was not found.
    echo Install Python 3.11+ from https://www.python.org/downloads/
    echo During setup, enable "Add python.exe to PATH".
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found. Install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found. Reinstall Node.js 20+ and enable PATH.
    pause
    exit /b 1
)

echo Python launcher: %PYTHON_CMD%
node --version
npm --version
echo.

if not exist "backend\.venv\Scripts\python.exe" (
    echo [1/5] Creating backend virtual environment...
    %PYTHON_CMD% -m venv backend\.venv
    if errorlevel 1 (
        echo ERROR: Could not create the Python virtual environment.
        pause
        exit /b 1
    )
)

echo [2/5] Installing backend dependencies...
call "backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo ERROR: Could not upgrade pip.
    pause
    exit /b 1
)
call "backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
    echo ERROR: Backend dependency installation failed. Check the error above and your internet connection.
    pause
    exit /b 1
)

pushd backend
if errorlevel 1 (
    echo ERROR: Backend folder was not found.
    pause
    exit /b 1
)
echo [3/5] Applying SQLite database migrations...
call ".venv\Scripts\python.exe" -m alembic upgrade head
if errorlevel 1 (
    popd
    echo ERROR: Database migration failed. See the migration error above.
    pause
    exit /b 1
)
echo [4/5] Loading demo data...
call ".venv\Scripts\python.exe" -m app.seed
if errorlevel 1 (
    popd
    echo ERROR: Demo-data seeding failed. See the Python error above.
    pause
    exit /b 1
)
popd

if not exist "frontend\node_modules" (
    echo [5/5] Installing frontend dependencies...
    pushd frontend
    call npm install
    if errorlevel 1 (
        popd
        echo ERROR: Frontend dependency installation failed.
        pause
        exit /b 1
    )
    popd
) else (
    echo [5/5] Frontend dependencies already installed; skipping npm install.
)

echo.
echo Starting ReChiplet API and frontend...
start "ReChiplet API" cmd /k "cd /d ""%~dp0backend"" && ""%~dp0backend\.venv\Scripts\python.exe"" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
start "ReChiplet Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo.
echo Frontend: http://localhost:5173
echo API docs: http://127.0.0.1:8000/docs
echo Keep both server windows open while using ReChiplet.
endlocal
