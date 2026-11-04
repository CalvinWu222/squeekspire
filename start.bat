@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 exit /b 1

set "PATH=C:\Users\Administrator\squeek-code\tools\node-v22.11.0-win-x64;%PATH%"
set "NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main"

if not exist "node_modules\" (
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

call npm.cmd run dev
exit /b %errorlevel%
