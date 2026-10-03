@echo off
setlocal
cd /d "%~dp0"
set "LECTURE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%LECTURE_NODE%" goto launch
set "LECTURE_NODE=node"
:launch
"%LECTURE_NODE%" scripts\launch.mjs %*
if errorlevel 1 pause
endlocal
