@echo off
setlocal
title Polynite: deploy dev -> site

REM ###############################################################
REM  Publishes dev\ over the ROOT of polynite-web.
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

REM Robocopy return codes 0-7 are success.
if errorlevel 8 goto :fail


REM ---------------------------------------------------------------
REM Mark this folder as the release version
REM ---------------------------------------------------------------

>"%DST%\tier.txt" echo release


REM ---------------------------------------------------------------
REM Increment release version
REM ---------------------------------------------------------------

set "VERSION=unknown"

if exist "%DST%\version_inc.bat" (
    call "%DST%\version_inc.bat"

    if exist "%DST%\version.txt" (
        set /p VERSION=<"%DST%\version.txt"
    )
)

echo.
echo  [polynite] Version: %VERSION%


REM ---------------------------------------------------------------
REM Sanity checks
REM ---------------------------------------------------------------

echo.
echo  [polynite] Deployed.
echo.

if exist "%DST%\App.js" (
    echo  WARNING: App.js is still here. Windows keeps the OLD case when it
    echo           overwrites; GitHub Pages is case-sensitive and the page asks
    echo           for app.js. Delete App.* here and in dev\, then rebuild.
)

if exist "%DST%\App.wasm" (
    echo  WARNING: App.wasm is still here - same problem.
)

if not exist "%DST%\app.js" (
    echo  WARNING: app.js is MISSING - the site will show the WebGPU notice.
)

if not exist "%DST%\backend.js" (
    echo  WARNING: backend.js missing - the shell will assume WebGPU.
)

if not exist "%DST%\CNAME" (
    echo  WARNING: CNAME is missing - GitHub Pages will drop the custom domain.
)

if not exist "%DST%\models\index.txt" (
    echo  WARNING: models\index.txt missing - run this again with: models
)


REM ---------------------------------------------------------------
REM Git commit + push
REM ---------------------------------------------------------------

echo.
echo  [polynite] Preparing Git commit...

git add -A

REM Check whether staging actually contains changes.
git diff --cached --quiet

if not errorlevel 1 (
    echo  [polynite] Nothing changed. Nothing to commit.
    goto :success
)

echo.
echo  [polynite] Commit: Deploy Polynite %VERSION%

git commit -m "Deploy Polynite %VERSION%"

if errorlevel 1 (
    echo.
    echo  [polynite] Git commit FAILED.
    goto :fail
)

echo.
echo  [polynite] Pushing...

git push --progress -- "origin" main:main

if errorlevel 1 (
    echo.
    echo  [polynite] Git push FAILED.
    goto :fail
)

goto :success


REM ===============================================================
REM SUCCESS
REM ===============================================================

:success

echo.
echo  ========================================
echo   Polynite %VERSION% published
echo  ========================================
echo.

goto :end


REM ===============================================================
REM CANCEL
REM ===============================================================

:cancel

echo.
echo  [polynite] Cancelled. Nothing was copied.
echo.

goto :end


REM ===============================================================
REM FAIL
REM ===============================================================

:fail

echo.
echo  ========================================
echo   [polynite] DEPLOY FAILED
echo  ========================================
echo.

goto :end


REM ===============================================================
REM END
REM ===============================================================

:end

endlocal
pause