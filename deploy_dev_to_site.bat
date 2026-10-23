@echo off
setlocal
title Polynite: prepare dev and rel
set "LOCAL_ONLY=0"
set "NO_PAUSE=0"
set "GIT_ONLY=0"
for %%A in (%*) do if /i "%%~A"=="--no-pause" set "NO_PAUSE=1"
for %%A in (%*) do (
 if /i "%%~A"=="--local" (set "LOCAL_ONLY=1") else if /i "%%~A"=="--no-pause" (set "NO_PAUSE=1") else if /i "%%~A"=="--git-only" (set "GIT_ONLY=1") else if /i "%%~A"=="--help" (goto :help) else (goto :usage)
)
echo [polynite] Preparing dev/rel. Progress and elapsed time follow.
node "%~dp0deploy_site.cjs" prepare
if errorlevel 1 goto :fail
if "%LOCAL_ONLY%"=="1" exit /b 0
echo [polynite] Publishing dev/rel through Git.
node "%~dp0deploy_site.cjs" sync-dev
if errorlevel 1 goto :fail
if "%GIT_ONLY%"=="1" goto :pushed
echo [polynite] Sending the pushed commit to Cloudflare Pages directly (no clone of the repository).
node "%~dp0deploy_cloudflare.cjs"
if errorlevel 1 goto :fail
:pushed
echo [polynite] Push complete. After the Cloudflare Pages build, test:
echo https://polynite.io/dev/ and https://polynite.io/rel/
if "%NO_PAUSE%"=="0" pause
exit /b 0
:help
echo Usage: deploy_dev_to_site.bat [--local] [--no-pause]
echo Default: prepare and publish dev/rel through Git without confirmation.
echo --local: prepare only. --git-only: push to Git without the direct Cloudflare upload. --no-pause: exit without waiting for a key.
exit /b 0
:usage
echo [polynite] Unknown option. Use --local, --git-only, --no-pause or --help.
exit /b 1
:fail
echo [polynite] Preparation or Git publication failed.
if "%LOCAL_ONLY%"=="0" if "%NO_PAUSE%"=="0" pause
exit /b 1
