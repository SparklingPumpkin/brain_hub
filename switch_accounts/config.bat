@echo off
:: ====================== 统一配置 ======================
set "ACCOUNT_BASE=D:\Projects\Agent\Brain_hub\switch_accounts\accounts"
set "DEST_FILE=%USERPROFILE%\.codex\auth.json"

:: 远程服务器（这里填你的信息）
set "REMOTE_HOST=cv4x4090"       :: 服务器IP或主机名
set "REMOTE_PATH=~/.codex/auth.json"
set "SSH_USER=usv012"              :: 用户名
set "SSH_PASS=???"     :: 密码（以后自动填）
:: ======================================================