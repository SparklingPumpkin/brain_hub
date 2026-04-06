@echo off
setlocal enabledelayedexpansion
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

:: 扫描账号
set idx=0
for /d %%D in ("%ACCOUNT_BASE%\*") do (
    set /a idx+=1
    set "name=%%~nxD"
    echo !idx!: !name!
    set "account_!idx!=!name!"
)

echo.
set /p "choice=请输入序号："

:: 获取选中账号
set "target_account=!account_%choice%!"
if not defined target_account (
    echo 无效选择！
    pause >nul
    exit
)

set "SRC_FILE=%ACCOUNT_BASE%\!target_account!\auth.json"
echo.
echo 正在切换 → !target_account!

:: 复制到本地（正确路径：.codex）
copy /y "!SRC_FILE!" "%USERPROFILE%\.codex\auth.json" >nul
echo ✅ 本地覆盖完成

:: ========================
:: 【和你手动命令完全一样】
:: ========================
echo 正在上传到服务器...
scp "%USERPROFILE%\.codex\auth.json" cv4x4090:~/.codex/auth.json

echo.
echo ✅ 账号切换 + 上传成功！
pause >nul