@echo off
setlocal
title Polynite: publish validated rel
if /i "%~1"=="--local" goto :copy
choice /c YN /n /m "Promote the validated rel to the public version? [Y/N] "
if errorlevel 2 goto :end
:copy
node "%~dp0deploy_site.cjs" publish
if errorlevel 1 goto :fail
if /i "%~1"=="--local" exit /b 0
choice /c YN /n /m "Publish the release to Cloudflare through Git? [Y/N] "
if errorlevel 2 goto :end
node "%~dp0deploy_site.cjs" sync-rel
if errorlevel 1 goto :fail
:end
endlocal
pause
exit /b 0
:fail
echo [polynite] Promotion or Git publication failed.
endlocal
if /i "%~1"=="--local" exit /b 1
pause
exit /b 1
