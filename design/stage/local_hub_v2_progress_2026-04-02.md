# Local Hub V2 现阶段完成进度说明

更新时间：2026-04-02
对应设计稿：`design/local_hub_v2_design_spec.md`

## 1. 当前阶段结论

Local Hub V2 已完成最小可用闭环（MVP）：

`Web Packet -> Hub -> Dispatch -> Mock Adapter -> Hub`

已具备接收、标准化、存储、调度、回传接收、状态聚合与查询能力，满足设计稿第 1-5 步的核心目标。

## 2. 已完成内容

### 2.1 项目结构与配置

已在仓库下创建独立实现子项目：

- `local_hub_v2/`

核心内容已包含：

- `hub.config.json`
- `src/`（按 API / packets / store / dispatch / state 拆分）
- `adapters/mock-codex-adapter.js`
- `test/hub.e2e.test.js`

### 2.2 数据模型与存储层（对应实施顺序第 1 步）

已实现并落盘：

- `PacketRecord`（strategy / execution / context）
- `RunRecord`
- `ProjectState`

已实现目录结构初始化与写入：

- `workflow_bridge/projects/<project_id>/packets/{strategy,execution,context}`
- `workflow_bridge/projects/<project_id>/runs/<cycle_id>/`
- `workflow_bridge/projects/<project_id>/state/`
- `workflow_bridge/queue/{pending,claimed,done}`

### 2.3 查询接口（对应实施顺序第 2 步）

已实现：

- `GET /projects/:projectId/state`
- `GET /projects/:projectId/latest-execution`
- `GET /projects/:projectId/latest-context-pack`

### 2.4 Codex 回传入口（对应实施顺序第 3 步）

已实现：

- `POST /packets/codex`

能力包括：

- 接收 execution report 与 context pack
- 生成并归档 execution/context packet
- 更新 RunRecord 与 ProjectState
- 写入 run history 与 dispatch log

### 2.5 调度能力（对应实施顺序第 4 步）

已实现：

- `POST /runs/:projectId/:cycleId/dispatch`
- `dispatchToCodex()`
- 状态推进：`pending -> dispatched -> running -> completed/needs_review/blocked`

### 2.6 Mock Adapter 闭环（对应实施顺序第 5 步）

已实现：

- `adapters/mock-codex-adapter.js`

当前行为：

- 读取 `strategy.packet.json`
- 构造 mock execution report / context pack
- 回调 `POST /packets/codex`

## 3. API 完成度

已完成接口：

- `GET /health`
- `POST /packets/web`
- `POST /packets/codex`
- `GET /projects/:projectId/state`
- `GET /projects/:projectId/latest-execution`
- `GET /projects/:projectId/latest-context-pack`
- `POST /runs/:projectId/:cycleId/dispatch`

## 4. 验证结果

已完成端到端测试：

- 命令：`npm test`
- 结果：`1 passed, 0 failed`
- 覆盖链路：
  - 发送 strategy packet
  - 手动 dispatch
  - mock adapter 回传 codex packet
  - 查询 project state / latest execution
  - 校验 run 最终状态为 `completed`

## 5. 与设计稿对应关系

已完成：

1. 固化 schema 与 store
2. 补项目状态查询接口
3. 实现 `POST /packets/codex`
4. 实现 `dispatch_to_codex()`
5. 接模拟 adapter

未完成：

6. 接真实 Codex CLI（当前仍为 mock adapter）

## 6. 当前遗留与风险

- 真实执行链路未接入，尚未验证真实代码仓执行与回传质量。
- remote worker 仅预留 queue，不含 claim/token 安全机制。
- 目前为文件存储形态，适合单机与调试期，不适合高并发场景。

## 7. 下一阶段建议

下一阶段目标：完成设计稿第 6 步，接入真实 Codex CLI adapter，并基于一个真实 demo 项目跑通完整回路并沉淀样例包（execution/context pack）。
