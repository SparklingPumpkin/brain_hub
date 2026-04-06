@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 新增账号
color 0B
mode con cols=70 lines=20

:: 加载统一配置
call "%~dp0config.bat"
set "SOURCE_FILE=%DEST_FILE%"

echo.
echo ==============================================================
echo           保存当前 auth.json 为新账号（纯净无中文时间戳）
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

:: ==============================================
:: 【终极纯净时间戳】无中文、无空格、无符号
:: 格式：YYYYMMDDHHmm （年月日时分）
:: ==============================================
for /f "tokens=2 delims==" %%a in ('wmic path win32_operatingsystem get LocalDateTime /value') do (
    set dt=%%a
)
set TIME_STR=!dt:~0,4!!dt:~4,2!!dt:~6,2!!dt:~8,2!!dt:~10,2!

:: 最终文件夹名：账号_时间戳
set "FINAL_DIR_NAME=%NEW_NAME%_%TIME_STR%"
set "TARGET_DIR=%ACCOUNT_BASE%\%FINAL_DIR_NAME%"
set "TARGET_FILE=%TARGET_DIR%\auth.json"

echo.
echo 创建文件夹：
echo %FINAL_DIR_NAME%
echo.

mkdir "%TARGET_DIR%" 2>nul
copy /y "%SOURCE_FILE%" "%TARGET_FILE%" >nul

echo.
echo ✅ 保存成功！
echo 文件夹：%FINAL_DIR_NAME%
echo.
pause >nul