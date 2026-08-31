@echo off
title Project Architect Launcher
echo ========================================================
echo   Starting Project Architect V1 (Local AI Workspace)
echo ========================================================
echo.
echo [1/2] Starting Backend REST Server on http://127.0.0.1:3001 ...
start "PA-Server" /min cmd /c "node apps/server/dist/index.js"

echo [2/2] Starting Frontend Web App on http://localhost:5174 ...
start "PA-Web" /min cmd /c "node apps/web/node_modules/vite/bin/vite.js apps/web --host 127.0.0.1 --port 5174"

echo.
echo ========================================================
echo   Services are running!
echo   - Web UI:  http://localhost:5174
echo   - Backend: http://127.0.0.1:3001
echo ========================================================
echo.
pause
