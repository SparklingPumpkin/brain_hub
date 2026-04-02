# Local Hub V2 详细设计稿

副标题：给 Codex 直接执行的实施级设计说明  
关联主线文档：`workflow_design.md`、`workflow_changelog.md`、`current_implementation_progress.md`、`recent_effective_context_summary.md`  
版本：v0.1（实施草案）  
日期：2026-04-02

---

## 1. 本文档的定位

本文档不是新的长期主设计稿，而是 **针对 Local Hub V2 的可执行实施说明**。  
它服务于一个非常明确的目标：让 Codex 能直接按本文档开始实现 Hub 从“仅接收网页 packet 的本地入口”，升级为“可接收、存储、调度、回收结果、管理状态”的最小编排器。

因此本文档回答的是以下问题：

- Hub 以什么形态存在。
- Hub 的职责边界是什么。
- Hub 的内部模块如何拆分。
- Hub 需要什么数据模型、目录结构、HTTP 接口和状态机。
- Hub 如何先接本地 Codex，再兼容远程服务器中的 Codex worker。
- Hub 的第一阶段交付应该做到什么程度才算完成。

---

## 2. 结论先行：Hub 应该以什么形式存在

## 2.1 当前推荐形态

**Hub 的当前正式实施形态应当是：运行在用户本机上的一个常驻本地后台服务（local background service / local daemon），对浏览器扩展和本地工具暴露 `127.0.0.1` 上的 HTTP API。**

它不是“先做一个完整 GUI 桌面应用”。

更具体地说：

- V1 / V2 阶段，Hub 的本质是一个 **本地常驻进程**。
- 它通过 `127.0.0.1:8765` 暴露 HTTP 接口。
- 浏览器扩展通过 localhost 调用它。
- Codex adapter 或远程 worker 也通过文件、命令行或 HTTP 与它交互。
- 它负责持久化 packet、维护状态、触发调度、回收执行结果。

## 2.2 不建议当前阶段优先做成什么

当前不建议优先做成：

- 一个功能复杂的 Electron GUI 桌面应用
- 一个云端中心服务
- 一个必须依赖网页端实时在线的中间层
- 一个把所有逻辑都塞进浏览器扩展里的实现

原因很简单：

1. 你已经验证可行的链路，是 **Edge 扩展 -> localhost Hub**。
2. 当前最缺的不是 UI，而是 **Hub -> Codex -> Hub** 的执行闭环。
3. 现在先把 Hub 做成稳定的后台服务，后续无论加系统托盘、Windows Service、菜单界面还是远程 worker，都只是外壳增强，不会改变核心架构。

## 2.3 后续可选包装形态

当 V2 跑稳之后，Hub 可以再被包装成以下任一形态：

- Windows 开机自启后台服务
- 带系统托盘图标的小型桌面工具
- 带最小控制台 UI 的本地 app shell
- 可安装版桌面应用（本质仍然是本地服务 + UI 壳）

**但这些都不是当前最优先事项。** 当前优先事项是把 Hub 的“编排器能力”做出来。

---

## 3. Hub 在整体系统中的角色

Hub 在双脑工作流中的定位不是聊天客户端，也不是代码执行器，而是 **结构化工件的本地中枢与最小编排器**。

它的职责是：

1. 接收网页端生成的 `context-packet`
2. 校验并标准化 packet
3. 存储 packet 与运行状态
4. 把 packet 投递给 Codex 执行端
5. 接收 `Execution Report` 与 `Context Pack`
6. 将结果归档，并为下一轮网页端接棒准备输入
7. 控制哪些情况自动继续，哪些情况必须停下来等待人工审查

它**不负责**：

- 替代网页端做战略判断
- 替代 Codex 做真实代码实现
- 在高风险情况下自动批准关键动作
- 变成一个通用任务平台

---

## 4. 设计目标

Local Hub V2 的目标非常聚焦：

### 4.1 第一目标

把以下链路从“纸面设计”变成“真实可跑”：

`context-packet -> Hub -> Codex -> execution packet -> Hub`

### 4.2 第二目标

把当前只会落盘到 `inbox/` 的本地入口，升级为最小可用的 **任务调度与状态管理中枢**。

### 4.3 第三目标

保持后续扩展空间：

- 支持本地 Codex CLI
- 支持远程服务器中的 Codex worker
- 支持将执行结果回供浏览器扩展
- 支持后续状态机、人工批准与自动继续策略

---

## 5. 非目标

V2 阶段明确不做以下事情：

- 不做复杂 GUI
- 不做多人协作队列
- 不做完整权限系统
- 不做数据库优先架构
- 不做复杂插件系统
- 不做云端统一控制平面
- 不做实时双向流式会话同步

V2 的成功关键不是“大而全”，而是把最小执行闭环做稳。

---

## 6. 推荐技术形态

## 6.1 推荐继续沿用当前 Node.js 方向

由于当前已有 `hub-server.js`、`npm start`、`GET /health`、`POST /packets/web` 这套基础形态，V2 建议继续沿用 **Node.js + TypeScript（或先 Node.js + JSDoc）** 的本地服务实现。

推荐理由：

- 与现有实现连续，迁移成本最低
- 本地 HTTP 服务实现简单直接
- 文件系统操作、JSON、子进程调度都很方便
- 后续包装成 Windows 后台服务或桌面壳也容易

## 6.2 进程形态

建议形态：

- 单进程本地服务
- 监听 `127.0.0.1:8765`
- 使用文件系统作为第一版持久层
- 使用显式 run 状态文件作为第一版状态存储

不建议 V2 一开始就做：

- 微服务拆分
- 外部数据库强依赖
- 消息中间件

---

## 7. 总体架构

```text
Edge 扩展
  -> POST /packets/web
      -> API Layer
      -> Packet Validation / Normalization
      -> Store Layer
      -> Run State Layer
      -> Dispatch Layer
           -> Local Codex Adapter
           -> 或 Remote Worker Queue/Claim
      -> POST /packets/codex
      -> Store Layer
      -> Result Aggregation
      -> Browser Read Model
```

Hub 内部建议拆成五层：

1. **API Layer**：接 HTTP 请求
2. **Packet Layer**：解析、校验、标准化 packet
3. **Store Layer**：写文件、索引、读取状态
4. **Dispatch Layer**：把任务交给 Codex 执行端
5. **Read Model Layer**：为浏览器扩展和人工检查输出当前视图

---

## 8. 模块划分

## 8.1 API 模块

职责：

- 提供 `GET /health`
- 提供 `POST /packets/web`
- 提供 `POST /packets/codex`
- 提供状态与查询接口
- 返回统一错误格式

建议文件：

- `src/server.ts`
- `src/routes/*.ts`

## 8.2 Packet 模块

职责：

- 解析 `context-packet`
- 校验字段与枚举值
- 补充内部字段
- 将网页字符串 packet 转为结构化对象

建议文件：

- `src/packets/schema.ts`
- `src/packets/parse.ts`
- `src/packets/normalize.ts`

## 8.3 Store 模块

职责：

- 生成目录
- 保存 packet
- 保存 run 状态
- 保存 latest index
- 提供按项目和 cycle 查询

建议文件：

- `src/store/fs-store.ts`
- `src/store/paths.ts`

## 8.4 Dispatch 模块

职责：

- 将待执行任务投递给本地 adapter
- 或将任务暴露给远程 worker claim
- 记录调度结果
- 处理超时、失败与重试

建议文件：

- `src/dispatch/dispatcher.ts`
- `src/dispatch/local-adapter.ts`
- `src/dispatch/remote-queue.ts`

## 8.5 State 模块

职责：

- 管理 run 状态
- 管理项目当前活动 cycle
- 更新 latest execution / latest context pack
- 决定是否进入 `needs_review`

建议文件：

- `src/state/run-state.ts`
- `src/state/project-state.ts`

---

## 9. 核心数据对象

V2 只需要先冻结三个核心对象：

1. `PacketRecord`
2. `RunRecord`
3. `ProjectState`

## 9.1 PacketRecord

用途：保存某一个结构化 packet 的标准化记录。

建议字段：

```json
{
  "packet_id": "pkt_20260402_0001",
  "packet_version": "v1",
  "packet_type": "strategy",
  "project_id": "demo",
  "cycle_id": "001",
  "stage": "strategy",
  "source": "web",
  "parent_packet_id": null,
  "created_at": "2026-04-02T12:00:00Z",
  "status": "pending",
  "raw_text": "project_id: demo...",
  "parsed": {
    "goal": "...",
    "constraints": ["..."],
    "next_action": "codex_execute"
  },
  "meta": {
    "page_url": "https://chatgpt.com/...",
    "sender": "edge-extension"
  }
}
```

## 9.2 RunRecord

用途：表示一个 `project_id + cycle_id` 的单轮执行记录。

建议字段：

```json
{
  "run_id": "run_demo_001",
  "project_id": "demo",
  "cycle_id": "001",
  "status": "pending",
  "strategy_packet_id": "pkt_20260402_0001",
  "execution_packet_id": null,
  "context_pack_id": null,
  "dispatch_mode": "local_adapter",
  "assigned_worker": null,
  "attempt_count": 0,
  "created_at": "2026-04-02T12:00:00Z",
  "updated_at": "2026-04-02T12:00:00Z",
  "last_error": null
}
```

## 9.3 ProjectState

用途：表示当前项目的聚合状态，给浏览器扩展和人工查看用。

建议字段：

```json
{
  "project_id": "demo",
  "active_cycle_id": "001",
  "latest_strategy_packet_id": "pkt_20260402_0001",
  "latest_execution_packet_id": null,
  "latest_context_pack_id": null,
  "current_status": "pending",
  "last_updated_at": "2026-04-02T12:00:00Z"
}
```

---

## 10. packet 类型与边界

V2 建议只处理三种 packet：

### 10.1 strategy packet

来源：网页端 ChatGPT  
方向：Web -> Hub -> Codex

内容核心：

- `project_id`
- `cycle_id`
- `stage: strategy`
- `goal`
- `constraints`
- `next_action`

### 10.2 execution packet

来源：Codex  
方向：Codex -> Hub -> Web

内容核心：

- 改动文件
- 核心修改点
- 测试/验证结果
- 未解决问题
- 风险
- 建议下一步

### 10.3 context pack

来源：Codex  
方向：Codex -> Hub -> 新网页端会话

内容核心：

- 当前目标
- 本轮已完成
- 涉及关键文件
- 最近验证结果
- 当前阻塞/开放问题
- 关键风险
- 建议下一步
- 给新网页端 ChatGPT 的恢复提示词

---

## 11. 状态模型

V2 不需要复杂状态机，先用 6 个状态就够：

- `pending`
- `dispatched`
- `running`
- `completed`
- `blocked`
- `needs_review`

建议状态转移：

```text
pending
  -> dispatched
  -> running
  -> completed

running
  -> blocked
  -> needs_review
  -> completed

completed
  -> pending   （进入下一 cycle）
```

### 11.1 进入 needs_review 的条件

以下情况进入 `needs_review`：

- Codex 明确报告风险或不确定性
- 测试失败
- 超出既定范围
- 需要人工批准后再继续
- Hub 无法判断是否可自动继续

### 11.2 进入 blocked 的条件

以下情况进入 `blocked`：

- 缺少运行环境
- 依赖缺失
- 无法访问代码库或远程机器
- 执行前置条件不满足

---

## 12. 存储设计

当前 `inbox/` 可保留作兼容入口，但 V2 建议切到按项目与 run 管理的目录结构。

推荐目录：

```text
workflow_bridge/
  projects/
    <project_id>/
      packets/
        strategy/
        execution/
        context/
      runs/
        <cycle_id>/
          run.json
          strategy.packet.json
          execution.packet.json
          context.pack.json
          dispatch.log
      state/
        current.json
        history.jsonl
      exports/
      logs/
  queue/
    pending/
    claimed/
    done/
  tmp/
```

说明：

- `packets/` 存所有标准化 packet 归档
- `runs/<cycle_id>/` 存该轮执行的聚合产物
- `state/current.json` 存项目当前态
- `history.jsonl` 追加状态变更历史
- `queue/` 为远程 worker 预留

---

## 13. API 设计

V2 最小接口建议如下。

## 13.1 健康检查

### `GET /health`

用途：

- 扩展与人工检查 Hub 是否在线

返回示例：

```json
{
  "ok": true,
  "service": "local-hub",
  "port": 8765,
  "version": "v2-alpha"
}
```

## 13.2 网页 packet 入口

### `POST /packets/web`

用途：

- 接收扩展发送的 `context-packet`

请求示例：

```json
{
  "source": "edge-extension",
  "packet": "project_id: demo\ncycle_id: 001\nstage: strategy\ngoal: ...\nconstraints:\n  - ...\nnext_action: codex_execute",
  "meta": {
    "page_url": "https://chatgpt.com/...",
    "conversation_hint": "..."
  }
}
```

返回示例：

```json
{
  "ok": true,
  "packet_id": "pkt_20260402_0001",
  "run_id": "run_demo_001",
  "status": "pending"
}
```

## 13.3 Codex 结果入口

### `POST /packets/codex`

用途：

- 接收本地 adapter 或远程 worker 回传结果

请求示例：

```json
{
  "project_id": "demo",
  "cycle_id": "001",
  "source": "codex-local-adapter",
  "execution_report": {
    "changed_files": ["src/a.ts", "src/b.ts"],
    "summary": ["..."],
    "verification": ["npm test 通过"],
    "open_issues": [],
    "risks": [],
    "next_step": "ready_for_review"
  },
  "context_pack": {
    "current_goal": "...",
    "completed": ["..."],
    "key_files": ["src/a.ts"],
    "latest_verification": ["npm test"],
    "open_questions": [],
    "risks": [],
    "suggested_next_step": "...",
    "web_recovery_prompt": "..."
  },
  "status": "completed"
}
```

返回示例：

```json
{
  "ok": true,
  "execution_packet_id": "pkt_20260402_0101",
  "context_pack_id": "pkt_20260402_0102",
  "run_status": "completed"
}
```

## 13.4 项目当前状态查询

### `GET /projects/:projectId/state`

用途：

- 给浏览器扩展或人工查看当前状态

## 13.5 最新执行结果查询

### `GET /projects/:projectId/latest-execution`

用途：

- 给浏览器扩展读取最近一轮 execution packet

## 13.6 手动触发调度

### `POST /runs/:projectId/:cycleId/dispatch`

用途：

- 调试期手动触发某一轮任务分发
- 避免一开始就把自动触发写死

---

## 14. 接收与标准化流程

`POST /packets/web` 进入后建议按以下流程执行：

1. 检查 JSON body 是否存在 `packet`
2. 检查 `packet` 是否为字符串
3. 解析成结构化对象
4. 校验必填字段
5. 补齐内部字段：
   - `packet_id`
   - `packet_version`
   - `packet_type`
   - `source`
   - `created_at`
   - `status`
6. 写入 `packets/strategy/`
7. 创建或更新 `runs/<cycle_id>/run.json`
8. 创建或更新 `state/current.json`
9. 视配置决定是否自动 `dispatch_to_codex()`

这一层的关键原则是：

- 扩展可以发送最小合法 packet
- Hub 负责补齐内部运行字段
- 所有组件对 packet 的理解必须统一

---

## 15. dispatch_to_codex 的实现策略

## 15.1 先做本地 adapter

第一版不要直接把 Hub 写死为“调用远程服务器”。  
应该先抽象成：Hub 只负责把任务交给 **执行端适配器**。

建议接口：

```ts
async function dispatchToCodex(runId: string, mode: "local_adapter" | "remote_worker"): Promise<void>
```

### local_adapter 模式

处理流程：

1. Hub 准备 `strategy.packet.json`
2. Hub 调用本地 adapter 命令
3. adapter 调 Codex CLI
4. Codex 执行
5. adapter 把结果 `POST /packets/codex`
6. Hub 更新 run 状态

建议第一版甚至允许 adapter 先“模拟执行”，只要能稳定跑通回传链路即可。

## 15.2 再兼容 remote_worker

remote_worker 模式不要求 Hub 直接推公网。

建议做法：

1. Hub 将待执行 run 写入本地 `queue/pending/`
2. 远程 worker 主动拉取或 claim 任务
3. worker 执行 Codex CLI
4. worker 将结果回传到 Hub 或中继层

这样做的优点：

- 本地 Hub 仍然是 source of truth
- 不要求本地机器先暴露公网端口
- 可以后续替换传输层而不改 Hub 核心模型

---

## 16. Local Adapter 设计

Local Adapter 是 Hub 与 Codex CLI 之间的薄适配层，不是第二个 Hub。

职责：

- 接收 Hub 提供的输入文件或参数
- 组织 Codex CLI 需要的执行上下文
- 调用 Codex CLI
- 收集 execution report / context pack
- 回传 Hub

不负责：

- 自己维护全局项目状态
- 自己决定长期任务队列策略

建议命令形态：

```bash
node codex-adapter.js \
  --input /path/to/strategy.packet.json \
  --hub http://127.0.0.1:8765 \
  --project demo \
  --cycle 001
```

---

## 17. 浏览器回传预留

V2 不要求马上实现自动回传网页端，但必须为其预留读取模型。

至少预留：

- `GET /projects/:projectId/latest-execution`
- `GET /projects/:projectId/state`
- `GET /projects/:projectId/latest-context-pack`

这样到 V3 时，扩展只要读取这些接口并展示即可，而不用反向侵入 Hub 内部结构。

---

## 18. 配置设计

建议配置文件：`hub.config.json`

建议字段：

```json
{
  "port": 8765,
  "root_dir": "./workflow_bridge",
  "auto_dispatch": false,
  "default_dispatch_mode": "local_adapter",
  "codex_adapter_cmd": "node ./codex-adapter.js",
  "allow_remote_worker": false,
  "approval_policy": "manual_on_risk",
  "log_level": "info"
}
```

关键说明：

- `auto_dispatch`：开发期建议先关，调试稳定后再开
- `approval_policy`：建议默认 `manual_on_risk`
- `allow_remote_worker`：远程未稳定前建议关闭

---

## 19. 日志与可观测性

至少保留三类日志：

1. **API 访问日志**
2. **Run 生命周期日志**
3. **Dispatch / 回传日志**

建议每轮 run 生成 `dispatch.log`，便于排错。

建议统一 log 字段：

- timestamp
- level
- project_id
- cycle_id
- run_id
- event
- message
- error

---

## 20. 错误处理原则

### 20.1 非法输入

对于非法 `packet`：

- 返回 400
- 返回明确错误字段
- 不静默吞掉

### 20.2 存储失败

对于写盘失败：

- 返回 500
- 日志写明路径与原因
- 不进入 dispatched

### 20.3 调度失败

对于 adapter 调用失败：

- run 状态改为 `blocked` 或 `needs_review`
- 写入 `last_error`
- 不伪造完成态

### 20.4 回传不完整

如果 execution report 有、context pack 没有：

- 允许进入 `needs_review`
- 标记缺失字段
- 不强制系统崩溃

---

## 21. 安全与边界控制

V2 只做最小本地安全控制：

- Hub 只监听 `127.0.0.1`
- 默认不对公网暴露
- 默认不允许匿名远程写入
- 高风险动作不自动继续
- 所有执行结果都可追溯到 run 和 packet

若未来接远程 worker，建议增加：

- worker token
- 签名头
- 基本来源校验
- 明确的 allowlist

---

## 22. 最小实施顺序（给 Codex 的执行顺序）

建议严格按下列顺序实施，不要跳步：

### 第 1 步：固化 schema 与 store

交付物：

- `PacketRecord` schema
- `RunRecord` schema
- `ProjectState` schema
- 文件目录初始化
- `POST /packets/web` 进入标准化存储

完成标准：

- 不再只写 `inbox/`
- 已可按项目与 cycle 保存标准化结果

### 第 2 步：补项目状态查询接口

交付物：

- `GET /projects/:projectId/state`
- `GET /projects/:projectId/latest-execution`

完成标准：

- 人能直接看到 run 当前状态
- 后续扩展读取接口已预留

### 第 3 步：实现 `POST /packets/codex`

交付物：

- execution report 回传入口
- context pack 回传入口
- 回传后的状态聚合逻辑

完成标准：

- Hub 可以接收并保存执行结果

### 第 4 步：实现 `dispatch_to_codex()`

交付物：

- `POST /runs/:projectId/:cycleId/dispatch`
- 本地 adapter 调用逻辑
- 状态从 `pending -> dispatched -> running`

完成标准：

- 人工可触发一轮本地执行

### 第 5 步：接模拟 adapter

交付物：

- 一个最小 mock adapter
- 能生成假 execution report / context pack 并回传

完成标准：

- `Web -> Hub -> Adapter -> Hub` 跑通

### 第 6 步：接真实 Codex CLI

交付物：

- 真实本地 adapter
- 至少一个真实项目中的执行样例

完成标准：

- 一轮真实执行可完成并回传结果

---

## 23. 验收标准

当以下全部满足时，Hub V2 视为达标：

1. 浏览器扩展发送的 `context-packet` 能被 Hub 校验、标准化、归档
2. Hub 能基于 `project_id + cycle_id` 创建 run 记录
3. Hub 能人工触发 dispatch
4. Local Adapter 能成功接收输入并回传结果
5. Hub 能接收 execution report 与 context pack
6. Hub 能正确更新 `ProjectState`
7. 系统在失败时能留下明确日志与状态，而不是静默失败
8. 后续浏览器扩展可通过只读接口获取最近结果

---

## 24. 直接给 Codex 的任务清单

1. 重构当前 `hub-server.js`，把 API、schema、store、dispatch、state 拆分模块。
2. 保留现有 `GET /health` 与 `POST /packets/web`，但把 `POST /packets/web` 改造成“解析 + 校验 + 标准化 + 建 run + 落盘”。
3. 新增 `POST /packets/codex`。
4. 新增 `GET /projects/:projectId/state`。
5. 新增 `GET /projects/:projectId/latest-execution`。
6. 新增 `POST /runs/:projectId/:cycleId/dispatch`。
7. 引入 `workflow_bridge/projects/...` 目录结构。
8. 实现 `dispatchToCodex()`，先接 mock adapter，再接真实 adapter。
9. 通过一个 demo project 跑通从网页 packet 到 execution packet 回传的闭环。
10. 输出一份实现后的 `Context Pack`，供下一轮网页端接棒。

---

## 25. 最终建议

对当前阶段，Hub 的最佳定义不是“桌面 app”，而是：

**一个运行在本机上的本地常驻编排服务，带 localhost HTTP API、文件持久层、最小状态机和执行调度能力。**

后续可以给它加外壳，但不要让“外壳”先于“编排能力”。  
当前真正要先做实的是：

**接收 -> 标准化 -> 存储 -> 调度 -> 回收 -> 状态更新**

只要这条链路稳定，远程 worker、浏览器回传、自动接棒都可以在此基础上继续长出来。
