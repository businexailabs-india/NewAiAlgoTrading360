@echo off
REM Installs the daily disk cleanup scheduled task (run as Administrator recommended)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-daily-disk-cleanup-task.ps1" %*
pause
