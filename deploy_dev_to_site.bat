@echo off
setlocal
title Polynite: deploy dev -> site

REM ###############################################################
REM  Publishes dev\ over the ROOT of polynite-web, and a light copy
REM  of the same build into web\.
REM
REM  web\ takes the models that Cloudflare Pages will actually accept -
REM  25 MiB per file, and it refuses the deployment over that - and
REM  then gets an index.txt GENERATED FROM WHAT LANDED. Copying the
REM  original index would list 45 models that are not there: a menu
REM  full of dead entries, which is worse than a short one.
REM
REM  The root is not filtered. It has no such limit, and it is the
REM  copy that holds everything.
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
echo         and a copy into web\ - models under 25 MiB only
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
REM The same build, into web\, without models\
REM
REM After the version bump on purpose: version.txt is written by it,
REM and the two copies saying different versions would be a bug that
REM only shows up in a bug report weeks later.
REM
REM Copies, like the one above - it does not mirror. Nothing already
REM in web\ is destroyed by a mistake in an exclusion list.
REM ---------------------------------------------------------------

set "WEB=%~dp0web"

if not exist "%WEB%" mkdir "%WEB%"

echo.
echo  [polynite] Copying into web\ ...

robocopy "%SRC%" "%WEB%" /E /XD "%SRC%\models" "%SRC%\.git" /XF version.txt tier.txt /XJ /NFL /NDL /NJH /R:1 /W:1

if errorlevel 8 goto :fail

REM ---------------------------------------------------------------
REM The models Pages will take: 25 MiB each, no more.
REM
REM 26214400 is the limit itself, not a margin under it - a file
REM exactly that size is accepted, and guessing lower would drop
REM models for nothing. It is written once, here.
REM
REM index.txt is EXCLUDED from the copy and rebuilt below. Copied,
REM it would describe the folder it came from rather than the one it
REM is in, and every model it names that did not fit would be a row
REM in the menu that fails when pressed.
REM ---------------------------------------------------------------

echo  [polynite] Models under 25 MiB into web\models\ ...

robocopy "%SRC%\models" "%WEB%\models" /E /MAX:26214400 /XF index.txt /XJ /NFL /NDL /NJH /R:1 /W:1

if errorlevel 8 goto :fail

REM ---------------------------------------------------------------
REM index.txt, written from what is actually there.
REM
REM "<name> <bytes>", the format the scanner reads with strrchr on a
REM space - so the SIZE is the last field and a name may contain
REM spaces, which one of these does.
REM
REM PowerShell rather than a for loop: a filename here contains
REM parentheses, and those close a batch block from inside a
REM redirect. WriteAllLines also writes UTF-8 with no BOM, where
REM Set-Content -Encoding utf8 would put three bytes in front of the
REM first filename and the first model would go missing.
REM ---------------------------------------------------------------

powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%WEB%\models'; $l=@(Get-ChildItem -Path (Join-Path $d '*') -Include *.glb,*.gltf -File | Sort-Object Name | ForEach-Object { $_.Name + ' ' + $_.Length }); [IO.File]::WriteAllLines((Join-Path $d 'index.txt'), $l); Write-Host ('  [polynite] web index: ' + $l.Count + ' models')"

if errorlevel 1 (
    echo  WARNING: could not write web\models\index.txt - Examples will be empty.
)

REM The same two files the root writes for itself, so the copy is not a
REM build that quietly believes it is something else.
>"%WEB%\tier.txt" echo release

if exist "%DST%\version.txt" copy /y "%DST%\version.txt" "%WEB%\version.txt" >nul


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

if not exist "%WEB%\app.js" (
    echo  WARNING: web\app.js is MISSING - the copy into web\ did not land.
)

if not exist "%WEB%\models\index.txt" (
    echo  WARNING: web\models\index.txt missing - Examples will be empty on the
    echo           Pages deployment, which serves web\.
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