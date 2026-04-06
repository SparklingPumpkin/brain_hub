@echo off
chcp 65001 >nul
title OpenAI 账号一键切换工具
color 0A
mode con cols=50 lines=25

:: 加载统一配置
call "%~dp0config.bat"

echo.
echo ==================================================
echo          OpenAI 账号一键切换工具
echo ==================================================
echo.

if not exist "%ACCOUNT_BASE%" (
    echo 错误：账号文件夹不存在！
    pause >nul
    exit
)

echo 可用账号列表：
echo.

set "idx=0"
set "account_list="
for /d %%D in ("%ACCOUNT_BASE%\*") do (
    set /a idx+=1
    call echo  %%idx%%：%%%%~nxD
    set "account_list=%%account_list%% %%idx%%:%%~nxD"
)

echo.
if %idx% equ 0 (
    echo 未找到任何账号文件夹
    pause >nul
    exit
)

set /p "choice=请输入序号切换账号："

set "target_account="
for %%i in (%account_list%) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%i") do (
        if %%a equ %choice% set "target_account=%%b"
    )
)

if not defined target_account (
    echo 无效选择！
    pause >nul
    exit
)

set "SRC_FILE=%ACCOUNT_BASE%\%target_account%\auth.json"

echo.
echo 正在切换 → %target_account%
echo ==================================================

if not exist "%SRC_FILE%" (
    echo 错误：未找到 auth.json
    pause >nul
    exit
)

copy /y "%SRC_FILE%" "%DEST_FILE%" >nul
echo ✅ 已覆盖本地配置

echo 正在上传到远程服务器...
scp "%DEST_FILE%" "%REMOTE_PATH%"

echo.
echo ✅ 切换完成！
echo.
pause >nul