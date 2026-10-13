@echo off
setlocal
title Polynite: prepare dev and rel
node "%~dp0deploy_site.cjs" prepare
if errorlevel 1 goto :fail
if /i "%~1"=="--local" exit /b 0
echo Test: https://polynite.io/dev/ and https://polynite.io/rel/
choice /c YN /n /m "Publish dev and rel to Cloudflare through Git? [Y/N] "
if errorlevel 2 goto :end
node "%~dp0deploy_site.cjs" sync-dev
if errorlevel 1 goto :fail
:end
endlocal
pause
exit /b 0
:fail
echo [polynite] Preparation or Git publication failed.
endlocal
if /i "%~1"=="--local" exit /b 1
pause
exit /b 1
