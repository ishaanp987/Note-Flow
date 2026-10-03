@echo off
setlocal
cd /d "%~dp0"
set "LECTURE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%LECTURE_NODE%" goto stop
set "LECTURE_NODE=node"
:stop
"%LECTURE_NODE%" scripts\launch.mjs --stop
if errorlevel 1 pause
endlocal
