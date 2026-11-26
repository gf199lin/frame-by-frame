@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo 未检测到 Node.js。请先安装 Node.js 20 或更高版本：https://nodejs.org/
  echo 或直接观看 03_演示视频 中的成片。
  echo.
  pause
  exit /b 1
)
node preview-server.mjs
pause
