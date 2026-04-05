# Local Hub V2 阶段进展与下一阶段规划

日期：2026-04-05  
关联总指导：`brain_hub/design/local_hub_v2_design_spec.md`

---

## 1. 当前阶段结论

截至当前，Local Hub V2 的**最小本地编排闭环已经完成并验证通过**。

已经跑通的链路是：

`strategy packet -> Local Hub -> mock adapter -> codex packet 回传 -> Local Hub 状态更新`

这意味着总指导中强调的“接收 -> 标准化 -> 存储 -> 调度 -> 回收 -> 状态更新”主链路，已经有了一个可实际运行的最小版本。

---

## 2. 现阶段已完成的工作

结合总指导第 22 节“最小实施顺序”，当前可以确认：

### 2.1 已完成第 1 步：固化 schema 与 store

已完成内容：

- 已将 Hub 拆分为 `routes / packets / store / dispatch / state / utils` 等模块
- 已实现 strategy packet 的解析、校验、标准化
- 已实现 `PacketRecord`、`RunRecord`、`ProjectState` 对应的数据落盘逻辑
- 已引入 `workflow_bridge/projects/...` 目录结构
- `POST /packets/web` 不再只是简单落到 `inbox/`，而是会创建标准化 packet、run 和 project state

结果：

- Hub 已经具备“按 `project_id + cycle_id` 管理运行轮次”的能力
- 文件系统已经成为当前版本的 source of truth

### 2.2 已完成第 2 步：项目状态查询接口

已实现接口：

- `GET /projects/:projectId/state`
- `GET /projects/:projectId/latest-execution`
- `GET /projects/:projectId/latest-context-pack`

结果：

- 浏览器扩展和人工检查都已经有了只读视图入口
- 后续浏览器侧读取结果时，不需要侵入 Hub 内部文件结构

### 2.3 已完成第 3 步：Codex 结果回传入口

已完成内容：

- 已实现 `POST /packets/codex`
- execution report 和 context pack 都可以回传
- 回传后会写入 packet 归档、run 记录、project state 和 dispatch log

结果：

- Hub 已经不是单向入口，而是具备结果回收能力的最小编排器

### 2.4 已完成第 4 步：dispatch_to_codex 与手动调度

已完成内容：

- 已实现 `POST /runs/:projectId/:cycleId/dispatch`
- 已实现本地 dispatch 流程
- 已实现 run 状态推进：
  `pending -> dispatched -> running -> completed / needs_review / blocked`
- 已实现调度日志写入

结果：

- Hub 已经可以人工触发某一轮执行
- 调试阶段不必依赖自动调度

### 2.5 已完成第 5 步：mock adapter 闭环

已完成内容：

- 已接入本地 mock adapter
- mock adapter 能读取 strategy packet
- mock adapter 能构造 execution report 和 context pack
- mock adapter 能把结果回传到 `POST /packets/codex`

结果：

- `Web -> Hub -> Adapter -> Hub` 闭环已经跑通
- 这一步已经证明 Hub 的编排骨架是成立的

### 2.6 已完成的运行验证

当前已经完成的验证包括：

- `npm test` 通过
- 项目自带的端到端测试已验证 strategy packet 接收、dispatch、结果回传、状态查询和 run 落盘
- 手工 HTTP 联调已验证：
  - `GET /health`
  - `POST /packets/web`
  - `POST /runs/:projectId/:cycleId/dispatch`
  - `GET /projects/:projectId/state`
  - `GET /projects/:projectId/latest-execution`
  - `GET /projects/:projectId/latest-context-pack`
- 按 `npm start` 的实际启动方式，Hub 也能正常对外提供 `127.0.0.1:8765` 服务

---

## 3. 当前阶段尚未完成的部分

对照总指导，当前最关键的未完成项有这些：

### 3.1 尚未完成第 6 步：接真实 Codex CLI

当前 dispatch 默认接的是 mock adapter，而不是真实 Codex CLI。

这意味着：

- 当前已经验证的是“编排闭环”
- 还没有完成“真实执行闭环”

### 3.2 浏览器扩展到 Hub 的真实联调还未固化为标准验收流程

虽然浏览器扩展已完成，Hub 也已完成，但当前已验证的重点仍然是 Hub 自身。

仍需要补齐：

- 扩展实际发包到 Hub 的端到端验收步骤
- 扩展读取 Hub 只读接口并展示结果的验收步骤

### 3.3 远程 worker 仍处于预留阶段

目前只有：

- `remote_worker` 的接口占位
- 本地 `queue/pending/` 的预留方向

但还没有真正实现：

- 任务 claim
- worker 身份校验
- 回传协议

### 3.4 自动继续策略与人工审查策略仍是最小形态

当前已有：

- `needs_review`
- `blocked`
- `approval_policy`

但还没有完成：

- 更明确的风险判定规则
- 浏览器或控制台侧的人工审查流程
- 自动继续的策略化控制

---

## 4. 下一阶段总目标

按照总指导，下一阶段不应该先去做 GUI、云端中心或复杂远程调度，而应该继续把**本地真实执行链路**做实。

下一阶段的总目标应定义为：

**把 Local Hub V2 从“mock adapter 可跑通”升级为“真实 Codex CLI 可执行、可回传、可被浏览器扩展接入”的本地编排器。**

---

## 5. 下一阶段工作规划

建议按以下顺序推进。

### 阶段 A：接入真实 Local Adapter

目标：

- 用真实 Codex CLI 替换 mock adapter
- 保持现有 Hub 协议、目录结构和状态模型不变

核心工作：

- 新建真实 adapter，输入仍使用 `strategy.packet.json`
- adapter 负责组织 Codex CLI 所需上下文
- adapter 执行真实任务后生成：
  - `execution_report`
  - `context_pack`
- adapter 回传 `POST /packets/codex`
- 保留 mock adapter，作为开发调试和回归测试基线

验收标准：

- 至少完成 1 个真实项目样例执行
- Hub 中能看到真实的 changed files、summary、verification、open issues、risks
- run 最终状态与真实执行结果一致，而不是固定假完成

### 阶段 B：固化扩展 <-> Hub 联调

目标：

- 把已经独立完成的浏览器扩展与本地 Hub 接通
- 形成稳定的本地双向工作流

核心工作：

- 验证扩展是否能直接发送合法 `strategy packet` 到 `POST /packets/web`
- 验证扩展能否读取：
  - `GET /projects/:projectId/state`
  - `GET /projects/:projectId/latest-execution`
  - `GET /projects/:projectId/latest-context-pack`
- 明确浏览器侧展示规则：
  - 当前状态
  - 最近执行结果
  - 最近 context pack

验收标准：

- 从扩展发起一轮真实 packet 后，Hub 正常创建 run
- 执行结束后，扩展能读取并展示最新状态和结果
- 整个链路不需要人工去文件夹找 JSON 才能知道结果

### 阶段 C：完善真实执行下的错误与审查机制

目标：

- 让真实执行失败时，Hub 能正确进入 `blocked` 或 `needs_review`
- 让“可继续”和“必须人工介入”有清晰边界

核心工作：

- 细化 adapter 失败、超时、部分回传、不完整回传的处理规则
- 完善 `last_error`、`dispatch.log` 和状态历史
- 明确以下场景的归类：
  - 环境问题
  - 权限问题
  - 执行失败
  - 测试失败
  - 风险过高

验收标准：

- 失败时不静默
- 状态、日志、错误原因三者一致
- 人能根据 `ProjectState + dispatch.log` 判断下一步动作

### 阶段 D：评估是否开启 auto_dispatch

目标：

- 在手动 dispatch 稳定之后，再决定是否开启自动分发

核心工作：

- 明确自动分发只适用于哪些 packet
- 避免浏览器扩展一发包就触发不可控执行
- 结合 `approval_policy` 设计保守默认值

建议：

- 在真实 adapter 和扩展联调都稳定之前，不建议默认开启 `auto_dispatch`

---

## 6. 下一阶段的具体任务清单

建议直接按以下任务执行：

1. 保留当前 mock adapter，不删除。
2. 新建真实 local adapter，并支持调用真实 Codex CLI。
3. 让真实 adapter 输出符合 `POST /packets/codex` 的统一 payload。
4. 选一个最小真实项目，跑通一次真实任务执行闭环。
5. 为真实 adapter 增加失败、超时和回传异常处理。
6. 用浏览器扩展对 Hub 发起一轮真实联调。
7. 让扩展读取 Hub 的只读接口并展示最新执行结果。
8. 补一份“扩展 -> Hub -> Codex -> Hub -> 扩展”的标准验收记录。

---

## 7. 当前阶段的判断

当前阶段不应再把主要精力放在：

- GUI 外壳
- 云端统一服务
- 复杂远程队列
- 多人协作能力

当前最值得继续投入的方向仍然是：

**把本地真实执行链路做实，把扩展和 Hub 真实接通，把失败与审查边界做清楚。**

这也是最符合总指导、并且最能继续降低系统不确定性的下一阶段路线。

---

## 8. 本轮执行更新（2026-04-05）

本轮已经实际执行并完成了“阶段 A：接入真实 Local Adapter”的核心工作。

### 8.1 已新增真实 Codex Adapter

已完成：

- 新增 `adapters/real-codex-adapter.js`
- 保留原有 `mock-codex-adapter.js` 不变
- 真实 adapter 已支持：
  - 读取 `strategy.packet.json`
  - 调用 `codex exec`
  - 用 JSON Schema 约束 Codex 最终输出结构
  - 解析 execution report / context pack / status
  - 自动回传 `POST /packets/codex`

### 8.2 已补充测试

已完成：

- 新增真实 adapter 的解析与归一化测试
- 新增真实 adapter 的回传测试
- 全量测试当前已通过

### 8.3 已完成真实链路冒烟验证

已实际验证：

- 使用真实 `codex exec`
- 在临时只读 workspace 中执行
- strategy packet 进入 Hub 后，手动 dispatch 成功
- 真实 adapter 成功回传 execution packet 和 context pack
- `ProjectState` 更新为 `completed`

验证结果说明：

- 这次不是 fake runner，也不是 mock adapter
- 是真实 Codex CLI 驱动的一轮最小执行闭环

### 8.4 下一步顺延目标

在阶段 A 核心能力已落地后，下一步优先级顺延为：

1. 阶段 B：固化浏览器扩展 <-> Hub 联调
2. 阶段 C：完善真实执行下的错误与审查机制
3. 阶段 D：最后再评估是否开启 `auto_dispatch`

---

## 9. 本轮执行更新（2026-04-06）

本轮已经完成“阶段 B：浏览器扩展 <-> Hub 联调”的核心交付。

### 9.1 已完成的扩展侧能力

已完成：

- 浏览器扩展继续保留 `POST /packets/web` 发包能力
- 后台脚本已新增 Hub 健康检查与项目状态读取
- 已新增扩展 popup，用于展示：
  - Hub 在线状态
  - 最新 packet 元数据
  - 当前 run 状态
  - 最新 execution summary
  - 最新 context pack 的建议下一步
- popup 已支持对最新 run 手动触发 dispatch

### 9.2 已完成的联调验证

已完成：

- 扩展后台脚本的 Node 模拟联调测试
- 测试覆盖链路：
  - 扩展消息 -> `POST /packets/web`
  - 读取 `GET /projects/:projectId/state`
  - 手动触发 `POST /runs/:projectId/:cycleId/dispatch`
  - 读取 `latest-execution` 与 `latest-context-pack`
- 扩展联调测试当前已通过

### 9.3 阶段 B 的完成判断

到当前为止，阶段 B 可以视为已经完成到“工程实现 + 自动化联调验证”层面。

剩余仅是浏览器中的人工点击验收：

- 在 Edge 里重新加载扩展
- 打开 popup
- 用真实 ChatGPT 页面再跑一轮人工观察

这一步属于最终人工验收，而不是功能缺失。
