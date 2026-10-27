@echo off
title STC, SAP 4th Bn - Smart Class Routine Scheduler
cd /d "%~dp0"

echo ======================================================================
echo          STC, SAP 4th Bn - Smart Class Routine Scheduler
echo ======================================================================
echo.

:: 1. Check if Node.js is installed
echo [1/3] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not found on this computer!
    echo Please download and install Node.js from https://nodejs.org
    echo Then run this file again.
    echo.
    pause
    exit /b 1
)

:: 2. Check if node_modules exists, install if missing
echo [2/3] Checking dependencies...

if exist "node_modules" goto skip_install

echo.
echo Node modules not found. Installing dependencies now (first run)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install packages. Please check your internet connection.
    echo.
    pause
    exit /b 1
)

:skip_install

:: 3. Launch browser and start Vite Server
echo [3/3] Starting Smart Routine Scheduler Web Server...
echo.
echo Application URL : http://localhost:3000
echo Training Center : STC, SAP 4th Bn
echo.
echo Opening your web browser automatically...
echo Press Ctrl + C in this window anytime to stop the server.
echo ======================================================================
echo.

:: Automatically open default browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Start the dev server
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo Server has stopped.
    pause
)