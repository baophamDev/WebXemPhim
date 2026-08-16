@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0.tools\node;%PATH%"
call "%~dp0.tools\node\npm.cmd" run build
