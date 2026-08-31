@echo off
setlocal
title Polynite: deploy dev -> site
REM ###############################################################
REM  Publishes dev\ over the ROOT of polynite-web, which is the
REM  released site served at https://polynite.io/.
REM
REM    deploy_dev_to_site.bat            everything EXCEPT models\
REM    deploy_dev_to_site.bat models     models\ as well
REM
REM  models\ is excluded by default because it is large and almost
REM  never changes between two deploys. But NOTHING ELSE fills the
REM  site's models\: the build writes to dev\models, so the released
REM  library only ever arrives through here. Run the "models" form
REM  after adding or re-optimising one. robocopy is incremental, so
REM  it then copies only what actually changed.
REM
REM  version.txt is always excluded - it is the DEPLOY FOLDER'S own
REM  counter and dev's is far behind the site's. Copying it would
REM  send the version backwards and browsers would stop reloading.
REM  The site's counter is bumped below instead.
REM
REM  tier.txt is always excluded too - and REWRITTEN below. The build
REM  stamps "dev" into dev\tier.txt; the site gets "release". Both
REM  folders therefore have one, which is deliberate: leaving the site
REM  without a file the page asks for on every load would answer the
REM  question with a permanent 404 in everyone's console.
REM ###############################################################

set "SRC=%~dp0dev"
set "DST=%~dp0."
set "XMODELS=/XD "%SRC%\models""
set "WHAT=everything except models\"
if /i "%~1"=="models" set "XMODELS="
if /i "%~1"=="models" set "WHAT=everything, models\ included"

if not exist "%SRC%\index.html" (
  echo  [polynite] %SRC%\index.html not found - nothing to deploy.
  goto :fail
)

echo.
echo  Deploying   %SRC%
echo         to   %~dp0
echo.
echo  Copying: %WHAT%
echo  Always excluded: version.txt, tier.txt
echo.
echo  Files removed from dev\ are NOT deleted here - this copies, it does not
echo  mirror. Nothing already on the site can be destroyed by a mistake in the
echo  exclusion list. .git, CNAME and README.md are left alone for the same
echo  reason: robocopy only writes what dev\ actually contains.
echo.


robocopy "%SRC%" "%DST%" /E %XMODELS% /XF version.txt tier.txt /XD "%SRC%\.git" /XJ /NFL /NDL /NJH /R:1 /W:1
REM robocopy: 0-7 is success, 8 and up is a real failure. `if errorlevel N`
REM means ">= N", so this is the documented way to read it.
if errorlevel 8 goto :fail

REM This folder IS the release, and says so. fs_assets.js reads it to decide
REM whether the released model library is beside the page or one level up -
REM a question no relative URL can answer once the site sits at a domain root.
>"%DST%\tier.txt" echo release

REM Bump the SITE's own version so version.js cache-busts app.js and app.wasm
REM for everyone still holding the old ones. Seeds itself when missing.
if exist "%DST%\version_inc.bat" call "%DST%\version_inc.bat"

echo.
echo  [polynite] Deployed.
echo.
if exist "%DST%\App.js"   echo  WARNING: App.js is still here. Windows keeps the OLD case when it
if exist "%DST%\App.js"   echo           overwrites; GitHub Pages is case-sensitive and the page asks
if exist "%DST%\App.js"   echo           for app.js. Delete App.* here and in dev\, then rebuild.
if exist "%DST%\App.wasm" echo  WARNING: App.wasm is still here - same problem.
if not exist "%DST%\app.js" echo  WARNING: app.js is MISSING - the site will show the WebGPU notice.
if not exist "%DST%\backend.js" echo  WARNING: backend.js missing - the shell will assume WebGPU.
if not exist "%DST%\CNAME" echo  WARNING: CNAME is missing - GitHub Pages will drop the custom domain.
if not exist "%DST%\models\index.txt" echo  WARNING: models\index.txt missing - run this again with: models
echo.
echo  Then commit and push polynite-web to publish.
goto :done

:cancel
echo  [polynite] Cancelled. Nothing was copied.
goto :done

:fail
echo  [polynite] DEPLOY FAILED.

:done
endlocal
pause
