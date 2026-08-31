@echo off
title Project Architect Stopper
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\stop.ps1"
echo.
pause
