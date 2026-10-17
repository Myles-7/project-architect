@echo off
cd /d "%~dp0"
title Stop Project Architect
echo ========================================================
echo   Stopping Project Architect Services (Ports 3001, 5174)
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-services.ps1 stop
echo.
echo [Done] Project Architect services stopped.
echo.
pause
