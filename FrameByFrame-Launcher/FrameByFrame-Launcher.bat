@echo off
rem ===========================================================================
rem  Frame by Frame - Windows Desktop Launcher (double-click entry point)
rem  This file only hands over to launcher.ps1 in a hidden window.
rem  All logic (single instance, service start, Edge app mode, cleanup) lives
rem  in launcher.ps1 so it can be tested and read on its own.
rem ===========================================================================
setlocal
set "DIR=%~dp0"

if not exist "%DIR%launcher.ps1" (
    echo [Frame by Frame] launcher.ps1 was not found next to this file.
    echo Expected: %DIR%launcher.ps1
    pause
    exit /b 1
)

start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%DIR%launcher.ps1"
exit /b 0
