@echo off
rem Polyvoid as a folder ready to ship. Needs the Studio and the Player built
rem (mesh\Wake_Make_[win64]_Studio.cwMake or _Dev, and _Player).
rem   export_polyvoid.bat              into Documents\polynite\polyvoid
rem   export_polyvoid.bat D:\ship\polyvoid
rem Set NO_PAUSE=1 to run it from another script.
setlocal
set "STUDIO=D:\dev\polynite-desktop\studio\app.exe"
set "SCENE=%~dp0polyvoid.scene"
set "OUT=%~1"
if "%OUT%"=="" set "OUT=%USERPROFILE%\Documents\polynite\polyvoid"

if not exist "%STUDIO%" (
   echo No Studio at %STUDIO%: build it first, or change STUDIO in this file.
   set CODE=2
   goto end
)
"%STUDIO%" --export "%SCENE%" --out "%OUT%" --name Polyvoid --title "Polyvoid" --app polyvoid --icon "%~dp0polyvoid.ico" --version 1.0.0 --company "Polynite"
set CODE=%ERRORLEVEL%
if not "%CODE%"=="0" echo The export failed, code %CODE%.

:end
if not defined NO_PAUSE pause
exit /b %CODE%
