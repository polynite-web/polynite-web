@echo off
setlocal
title Polynite: send the pushed commit to Cloudflare Pages
REM Direct upload of web/ exactly as committed in HEAD (push first). Options pass through:
REM   --branch <name> for a preview only, --allow-unpushed, --no-pause
set "NO_PAUSE=0"
for %%A in (%*) do if /i "%%~A"=="--no-pause" set "NO_PAUSE=1"
node "%~dp0deploy_cloudflare.cjs" %*
set "CODE=%ERRORLEVEL%"
if "%NO_PAUSE%"=="0" pause
exit /b %CODE%
