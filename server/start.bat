@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title Laser-Zeichen-App Server

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Erster Start: Pakete werden installiert ...
  call npm install
)
if not exist dist\index.html (
  echo Die App wird gebaut ...
  call npm run build
)

node server\server.mjs
echo.
echo Der Server wurde beendet.
pause
