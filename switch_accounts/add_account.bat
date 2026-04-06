@echo off
chcp 65001 >nul
title 新增账号（自动加时间戳）
color 0B
mode con cols=70 lines=20

:: 加载统一配置
call "%~dp0config.bat"

set "SOURCE_FILE=%DEST_FILE%"

echo.
echo ==============================================================
echo           保存当前 auth.json 为新账号（自动加时间）
echo ==============================================================
echo.

if not exist "%SOURCE_FILE%" (
    echo 错误：未找到当前 auth.json
    pause >nul
    exit
)

set "NEW_NAME="
set /p "NEW_NAME=请输入账号名称（例如 account1）："

if not defined NEW_NAME (
    echo 账号名称不能为空！
    pause >nul
    exit
)

:: 时间戳：年月日-时分
set "YMD=%date:~0,4%%date:~5,2%%date:~8,2%"
set "HMS=%time:~0,2%%time:~3,2%"
set "HMS=%HMS: =0%"
set "TIME_STR=%YMD%-%HMS%"

set "FINAL_DIR_NAME=%NEW_NAME%_%TIME_STR%"
set "TARGET_DIR=%ACCOUNT_BASE%\%FINAL_DIR_NAME%"
set "TARGET_FILE=%TARGET_DIR%\auth.json"

echo.
echo 创建：%TARGET_DIR%
echo.

mkdir "%TARGET_DIR%" 2>nul
copy /y "%SOURCE_FILE%" "%TARGET_FILE%" >nul

echo.
echo ✅ 保存成功：%FINAL_DIR_NAME%
echo.
pause >nul