@echo off
set PROJECT_ID=%1
set CYCLE_ID=%2
shift
shift
set GOAL=%*

if "%PROJECT_ID%"=="" (
  echo Usage: open-chatgpt-context-session.cmd ^<project_id^> ^<cycle_id^> ^<goal...^>
  exit /b 1
)

if "%CYCLE_ID%"=="" (
  echo Usage: open-chatgpt-context-session.cmd ^<project_id^> ^<cycle_id^> ^<goal...^>
  exit /b 1
)

if "%GOAL%"=="" (
  echo Usage: open-chatgpt-context-session.cmd ^<project_id^> ^<cycle_id^> ^<goal...^>
  exit /b 1
)

powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\open-chatgpt-context-session.ps1" -ProjectId "%PROJECT_ID%" -CycleId "%CYCLE_ID%" -Goal "%GOAL%" -EnsureHubRunning
