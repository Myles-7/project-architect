@echo off
cd /d "%~dp0"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
node -e "if(process.versions.node.split('.')[0]!=='24'){console.error('Project Architect requires Node.js 24 LTS. Current: '+process.version);process.exit(1)}"
if errorlevel 1 (
  echo Install or select Node.js 24 LTS before starting.
  pause
  exit /b 1
)
title Project Architect Launcher
echo ========================================================
echo   Starting Project Architect V1 (Local AI Workspace)
echo ========================================================
echo.

echo [Pre-flight] Checking ports 3001 and 5174...
node scripts/check-local-services.mjs preflight
if errorlevel 1 (
  pause
  exit /b 1
)

echo [Build] Compiling workspace packages, contracts and document templates...
call pnpm build
if errorlevel 1 (
  echo [Error] Full build failed. Please check build logs.
  pause
  exit /b 1
)

echo.
echo Starting Backend and Web App...
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-services.ps1 start
if errorlevel 1 (
  pause
  exit /b 1
)
node scripts/check-local-services.mjs ready
if errorlevel 1 (
  echo [Error] Read pa-server-error.log and pa-web-error.log for details.
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-services.ps1 stop
  pause
  exit /b 1
)

echo.
echo ========================================================
echo   Services are running!
echo   - Web UI:  http://localhost:5174
echo   - Backend: http://127.0.0.1:3001
echo   (Press any key to close this launcher window)
echo ========================================================
echo.
pause
