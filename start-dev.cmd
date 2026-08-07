@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo Starting AppShield AI development services...
echo.

where docker >nul 2>nul
if %errorlevel% equ 0 (
  echo Starting Docker services: Postgres, MongoDB, Redis...
  pushd "%ROOT%" >nul
  docker compose up -d
  if errorlevel 1 (
    echo.
    echo Docker services failed to start. Open Docker Desktop, wait until it is running, then run this file again.
    popd >nul
    pause
    exit /b 1
  )
  popd >nul
) else (
  echo Docker was not found in PATH. Skipping Docker Compose startup.
  echo Start Docker Desktop or run docker compose up -d manually if database features are needed.
)

if not exist "%BACKEND%\venv\Scripts\python.exe" (
  echo.
  echo Backend virtual environment was not found:
  echo %BACKEND%\venv
  echo Create it first using the README setup steps.
  pause
  exit /b 1
)

if not exist "%FRONTEND%\node_modules" (
  echo.
  echo Frontend dependencies were not found:
  echo %FRONTEND%\node_modules
  echo Run npm.cmd install in the frontend folder first.
  pause
  exit /b 1
)

echo Starting backend on http://localhost:8000 ...
start "AppShield AI Backend" /D "%BACKEND%" cmd /k "call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

echo Starting frontend on http://localhost:3000 ...
start "AppShield AI Frontend" /D "%FRONTEND%" cmd /k "npm.cmd run dev"

echo.
echo AppShield AI is starting.
echo Keep the Backend and Frontend terminal windows open while using the app.
echo Open http://localhost:3000 after the frontend reports it is ready.
echo.
pause
