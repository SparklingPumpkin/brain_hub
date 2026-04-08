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

当前仓库里的 `hub.config.json` 已默认切到真实 Codex CLI adapter，并且会优先把项目执行目录映射到 `demo_projects/<project_id>`。

如果你想手动调整，可把 `hub.config.json` 里的 `codex_adapter_cmd` 改成类似下面的形式：

```json
{
  "codex_adapter_cmd": "node ./adapters/real-codex-adapter.js --codex-exec-cmd \"codex exec\" --sandbox workspace-write"
}
```

同时可选配置项目工作目录：

```json
{
  "default_project_workdir_root": "./demo_projects",
  "project_workdirs": {
    "personal_blog_smoke": "./demo_projects/personal_blog_smoke"
  }
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
- 支持 `session_mode/session_id`，可指定或复用 Codex 会话
- 要求 Codex 按 JSON Schema 输出 `execution_report`、`context_pack`、`status`
- 自动回传到 `POST /packets/codex`
- 自动把 `project_id` 解析到对应工作目录，再执行真实任务

可选的 strategy 字段：

```text
session_mode: new|resume|project|last
session_id: <uuid>
```

- `new`：默认，开新会话
- `resume`：使用给定 `session_id`
- `project`：优先复用项目最近一次成功记录的 Codex session；没有时会创建一个可复用的新会话
- `last`：复用当前工作目录下最近一次 Codex 会话

## 安卓 / Tailscale 远程控制

Hub 现在支持一个独立的远程控制面板：

- 页面：`GET /remote`
- API：`/remote-api/*`

要启用它，建议这样配置：

```json
{
  "host": "0.0.0.0",
  "remote_control_enabled": true,
  "remote_control_token": "replace-with-a-long-random-token",
  "remote_control_title": "Local Hub Remote"
}
```

然后通过 Tailscale 访问你的机器地址，例如：

```text
http://<tailscale-ip>:8765/remote
```

远程面板支持：

- 查看项目列表和当前状态
- 查看最新 execution/context
- 新建任务
- 手动 dispatch 指定 run

说明：

- 现有浏览器扩展仍然继续走本地 `127.0.0.1`
- 远程控制使用独立的 bearer token 鉴权，不会影响本地扩展

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
