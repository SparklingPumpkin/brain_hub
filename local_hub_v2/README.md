# Local Hub V2

基于 `design/local_hub_v2_design_spec.md` 实现的最小本地 Hub 编排器。

## 已实现范围

- `GET /health`
- `POST /packets/web`
- `POST /packets/codex`
- `GET /projects/:projectId/state`
- `GET /projects/:projectId/latest-execution`
- `GET /projects/:projectId/latest-context-pack`
- `POST /runs/:projectId/:cycleId/dispatch`
- 文件持久层 `workflow_bridge/...`
- 本地 mock adapter 闭环
- 真实 Codex CLI adapter 脚手架与回传协议

## 运行

```bash
npm start
```

默认监听 `127.0.0.1:8765`。

在 Windows 上也可以直接用：

```powershell
.\scripts\start-local-hub.ps1
```

或者双击：

```text
start-local-hub.cmd
```

常用管理脚本：

- `.\scripts\start-local-hub.ps1`：后台启动 Hub
- `.\scripts\start-local-hub.ps1 -Foreground`：前台启动，适合看实时日志
- `.\scripts\stop-local-hub.ps1`：停止 Hub
- `.\scripts\hub-status.ps1`：查看 Hub 状态
- `.\scripts\install-hub-autostart.ps1`：安装 Windows 登录自启动
- `.\scripts\remove-hub-autostart.ps1`：取消 Windows 登录自启动

## 测试

```bash
npm test
```

## 切换到真实 Codex Adapter

默认配置仍然使用 mock adapter，避免影响当前可用闭环。

如果要切换到真实 Codex CLI，可把 `hub.config.json` 里的 `codex_adapter_cmd` 改成类似下面的形式：

```json
{
  "codex_adapter_cmd": "node ./adapters/real-codex-adapter.js --codex-exec-cmd \"codex exec\" --sandbox workspace-write"
}
```

常用可选参数：

- `--workdir <DIR>`：指定 Codex 实际执行的工作目录
- `--model <MODEL>`：指定模型
- `--profile <PROFILE>`：指定 Codex profile
- `--skip-git-repo-check`：允许在非 Git 仓库目录执行

真实 adapter 会：

- 读取 `strategy.packet.json`
- 调用 `codex exec`
- 要求 Codex 按 JSON Schema 输出 `execution_report`、`context_pack`、`status`
- 自动回传到 `POST /packets/codex`

## 一键打开 ChatGPT 并准备 context-packet 提示词

如果你想直接进入“网页端 ChatGPT -> 扩展捕获 -> Local Hub”的流程，可以用：

```powershell
.\scripts\open-chatgpt-context-session.ps1 `
  -ProjectId demo `
  -CycleId 001 `
  -Goal "Create a landing page for my portfolio" `
  -Constraint "Keep it static" `
  -Constraint "Use plain HTML and CSS" `
  -EnsureHubRunning
```

这个脚本会：

- 如果需要，先启动 Local Hub
- 自动把 `context-packet` 提示词复制到剪贴板
- 打开 ChatGPT 页面

也可以用简化版：

```text
open-chatgpt-context-session.cmd demo 001 Create a landing page for my portfolio
```
