@echo off
title Create Desktop Shortcut
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\create-desktop-shortcut.ps1"
echo.
pause
