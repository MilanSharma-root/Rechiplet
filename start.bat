@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ReChiplet Setup

echo.
echo ========================================
echo          ReChiplet Setup
echo ========================================
echo Project folder: %CD%
echo.

rem Detect an installed Python 3.11 or newer.
set "PYTHON_CMD="
where py >nul 2>&1
if not errorlevel 1 (
    py -3.11 --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=py -3.11"
)
if not defined PYTHON_CMD (
    where py >nul 2>&1
    if not errorlevel 1 (
        py -3 --version >nul 2>&1
        if not errorlevel 1 (
            py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
            if not errorlevel 1 set "PYTHON_CMD=py -3"
        )
    )
)
if not defined PYTHON_CMD (
    where python >nul 2>&1
    if not errorlevel 1 (
        python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
        if not errorlevel 1 set "PYTHON_CMD=python"
    )
)
if not defined PYTHON_CMD goto NO_PYTHON

where node >nul 2>&1
if errorlevel 1 goto NO_NODE
where npm >nul 2>&1
if errorlevel 1 goto NO_NPM

echo Using Python: %PYTHON_CMD%
%PYTHON_CMD% --version
node --version
npm --version
echo.

if not exist "backend\app\main.py" (
    echo ERROR: backend\app\main.py was not found.
    echo Make sure this is the ReChiplet project root.
    goto FAIL
)
if not exist "frontend\package.json" (
    echo ERROR: frontend\package.json was not found.
    echo Make sure the full project was extracted.
    goto FAIL
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [1/5] Creating Python virtual environment...
    %PYTHON_CMD% -m venv "backend\.venv"
    if errorlevel 1 goto VENV_FAIL
)

echo [2/5] Installing backend dependencies...
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto PIP_FAIL
"backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 goto REQUIREMENTS_FAIL

echo [3/5] Applying SQLite database migrations...
pushd backend
if errorlevel 1 goto BACKEND_DIR_FAIL
".venv\Scripts\python.exe" -m alembic upgrade head
if errorlevel 1 (
    popd
    goto MIGRATION_FAIL
)

echo [4/5] Seeding sample data...
".venv\Scripts\python.exe" -m app.seed
if errorlevel 1 (
    popd
    goto SEED_FAIL
)
popd

if not exist "frontend\node_modules\vite\bin\vite.js" (
    echo [5/5] Installing frontend dependencies...
    pushd frontend
    if errorlevel 1 goto FRONTEND_DIR_FAIL
    call npm install
    if errorlevel 1 (
        popd
        goto NPM_INSTALL_FAIL
    )
    popd
) else (
    echo [5/5] Frontend dependencies already installed.
)

echo.
echo Starting backend and frontend...
start "ReChiplet API" cmd /k "cd /d ""%CD%\backend"" && ""%CD%\backend\.venv\Scripts\python.exe"" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
start "ReChiplet Frontend" cmd /k "cd /d ""%CD%\frontend"" && npm run dev"
echo.
echo Frontend: http://localhost:5173
echo API docs: http://127.0.0.1:8000/docs
echo Keep both server windows open.
echo.
pause
exit /b 0

:NO_PYTHON
echo ERROR: Python 3.11 or newer was not found.
echo Install Python from https://www.python.org/downloads/
echo Enable "Add python.exe to PATH" during installation.
goto FAIL
:NO_NODE
echo ERROR: Node.js was not found. Install Node.js 20+ from https://nodejs.org/
goto FAIL
:NO_NPM
echo ERROR: npm was not found. Reinstall Node.js and enable PATH.
goto FAIL
:VENV_FAIL
echo ERROR: Could not create the virtual environment.
goto FAIL
:PIP_FAIL
echo ERROR: pip upgrade failed. Check your internet connection.
goto FAIL
:REQUIREMENTS_FAIL
echo ERROR: Python dependency installation failed.
goto FAIL
:BACKEND_DIR_FAIL
echo ERROR: Could not enter backend directory.
goto FAIL
:MIGRATION_FAIL
echo ERROR: SQLite migration failed. Read the error above.
goto FAIL
:SEED_FAIL
echo ERROR: Sample data seeding failed. Read the error above.
goto FAIL
:FRONTEND_DIR_FAIL
echo ERROR: Could not enter frontend directory.
goto FAIL
:NPM_INSTALL_FAIL
echo ERROR: npm install failed. Check Node/npm and your internet connection.
goto FAIL
:FAIL
echo.
echo Setup stopped. Copy the error text above and send it in ChatGPT.
pause
exit /b 1
