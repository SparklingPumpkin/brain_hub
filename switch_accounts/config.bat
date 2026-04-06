@echo off
:: 所有路径统一在这里配置，改这一个文件即可

:: 你的账号根目录
set "ACCOUNT_BASE=D:\Projects\Agent\Brain_hub\switch_accounts\accounts"

:: 本地目标 auth.json
set "DEST_FILE=%USERPROFILE%\.codex\auth.json"

:: 远程服务器路径
set "REMOTE_PATH=cv4x4090:~/.codex/auth.json"