@echo off
rem Arranca la ventanita guia de Exile Copilot. Doble clic y listo.
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo Preparando la ventanita la primera vez...
  call npm install --no-audit --no-fund
  node node_modules\electron\install.js
)
node build.mjs || (pause & exit /b 1)
start "" node_modules\electron\dist\electron.exe .
