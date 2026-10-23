@echo off
setlocal
title Polynite: publish validated rel
set "LOCAL_ONLY=0"
set "NO_PAUSE=0"
set "GIT_ONLY=0"
for %%A in (%*) do if /i "%%~A"=="--no-pause" set "NO_PAUSE=1"
for %%A in (%*) do (
 if /i "%%~A"=="--local" (set "LOCAL_ONLY=1") else if /i "%%~A"=="--no-pause" (set "NO_PAUSE=1") else if /i "%%~A"=="--git-only" (set "GIT_ONLY=1") else if /i "%%~A"=="--help" (goto :help) else (goto :usage)
)
echo [polynite] Promoting the validated rel snapshot to the public version.
node "%~dp0deploy_site.cjs" publish
if errorlevel 1 goto :fail
if "%LOCAL_ONLY%"=="1" exit /b 0
echo [polynite] Publishing the public version through Git.
node "%~dp0deploy_site.cjs" sync-rel
if errorlevel 1 goto :fail
if "%GIT_ONLY%"=="1" goto :pushed
echo [polynite] Sending the pushed commit to Cloudflare Pages directly (no clone of the repository).
node "%~dp0deploy_cloudflare.cjs"
if errorlevel 1 goto :fail
:pushed
echo [polynite] Push complete. Cloudflare Pages will update https://polynite.io/
if "%NO_PAUSE%"=="0" pause
exit /b 0
:help
echo Usage: deploy_rel_to_site.bat [--local] [--no-pause]
echo Default: promote the validated rel and publish through Git without confirmation.
echo --local: promote locally only. --git-only: push to Git without the direct Cloudflare upload. --no-pause: exit without waiting for a key.
exit /b 0
:usage
echo [polynite] Unknown option. Use --local, --git-only, --no-pause or --help.
exit /b 1
:fail
echo [polynite] Promotion or Git publication failed.
if "%LOCAL_ONLY%"=="0" if "%NO_PAUSE%"=="0" pause
exit /b 1
