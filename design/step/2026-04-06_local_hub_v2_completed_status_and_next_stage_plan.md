# Local Hub V2 当前完成情况与下一阶段规划

日期：2026-04-06  
关联总指导：`brain_hub/design/local_hub_v2_design_spec.md`

---

## 1. 当前阶段结论

截至当前，Local Hub V2 已经从“最小可跑的本地编排骨架”推进到“真实执行默认可用、扩展可接入、结果可回传 ChatGPT”的阶段。

已经打通的主链路是：

`ChatGPT -> 浏览器扩展 -> Local Hub -> 真实 Codex adapter -> Local Hub -> 浏览器扩展 -> ChatGPT`

这意味着：

- 本地 Hub 已不再只是 mock 编排器
- 真实 `codex exec` 已能作为默认执行端参与闭环
- 浏览器扩展不只负责发包，也已经能读取结果并把结果送回当前 ChatGPT 线程

---

## 2. 截至当前已完成的内容

### 2.1 Local Hub 核心编排能力已完成

已完成：

- `POST /packets/web`
- `POST /packets/codex`
- `POST /runs/:projectId/:cycleId/dispatch`
- `GET /projects/:projectId/state`
- `GET /projects/:projectId/latest-execution`
- `GET /projects/:projectId/latest-context-pack`
- 文件型持久化存储与 `workflow_bridge/projects/...` 目录结构
- `PacketRecord / RunRecord / ProjectState / dispatch.log` 全链路状态落盘

结果：

- Hub 已具备接收、标准化、存储、调度、回收、状态更新的完整本地编排能力

### 2.2 mock adapter 与真实 adapter 都已具备

已完成：

- 保留 `mock-codex-adapter.js` 作为回归基线
- 新增 `real-codex-adapter.js`
- 真实 adapter 已支持：
  - 读取 `strategy.packet.json`
  - 调用真实 `codex exec`
  - 用 JSON Schema 约束输出
  - 解析 `execution_report / context_pack / status`
  - 自动回传 `POST /packets/codex`

结果：

- 开发调试可以继续使用 mock
- 默认使用场景已可切到真实执行

### 2.3 Hub 默认配置已切到真实执行

已完成：

- `hub.config.json` 默认 `codex_adapter_cmd` 已切到真实 adapter
- 新增项目工作目录映射能力：
  - `default_project_workdir_root`
  - `project_workdirs`
- dispatch 时可按 `project_id` 自动补 `--workdir`

结果：

- 新启动的 Hub 默认走真实 adapter
- `personal_blog_smoke` 这类项目会直接落到对应 demo workspace 执行

### 2.4 浏览器扩展 <-> Hub 联调已完成

已完成：

- 扩展可捕获 ChatGPT 输出的 `context-packet`
- 扩展后台可把 packet 发到 `POST /packets/web`
- 扩展 popup 可展示：
  - Hub 在线状态
  - 最新 packet
  - 当前 run 状态
  - latest execution summary
  - latest context pack 的建议下一步
- popup 支持手动 `Dispatch Latest Run`

结果：

- “扩展发包 -> Hub 建 run -> 扩展读回状态”这条链路已完成

### 2.5 扩展已支持 auto dispatch 开关

已完成：

- popup 新增 `Auto Dispatch` 开关
- 开启时：
  - 扩展抓到新 packet 后自动 dispatch
- 关闭时：
  - 保持手动点击 `Dispatch Latest Run`

结果：

- 自动分发已能按用户当前工作方式切换
- 控制权保留在扩展侧，而不是直接把 Hub 全局默认改成激进模式

### 2.6 Hub 执行结果已可回传 ChatGPT

已完成：

- run 进入 `completed / needs_review / blocked` 后，扩展会读取最新 context pack
- 扩展会把整理后的 `local-hub-context` 自动写回原始 ChatGPT 标签页
- 回传内容包括：
  - project / cycle / status
  - summary
  - verification
  - open issues / risks
  - suggested next step
  - `web_recovery_prompt`

结果：

- “Hub 执行完成后把上下文送回 ChatGPT，等待下一步指令”的循环已经具备工程实现

### 2.7 真实项目样例已验证通过

已完成：

- `personal_blog_smoke / cycle 001` 跑通过真实网页生成样例
- `personal_blog_smoke / cycle 002` 跑通过扩展抓包与 Hub dispatch 链路
- `personal_blog_smoke / cycle 003` 在新的默认真实配置下成功修改 `index.html`

结果：

- 当前默认 Hub 配置确实已经不是 mock
- 真实执行、结果回传、项目文件修改已被实际验证

### 2.8 工具链与启动方式已补齐

已完成：

- `start-local-hub.ps1`
- `stop-local-hub.ps1`
- `hub-status.ps1`
- `open-chatgpt-context-session.ps1`
- 对应 `.cmd` 入口
- 可选 Windows 自启动安装/移除脚本

结果：

- 本地 Hub 的启动、停止、状态检查、打开 ChatGPT 会话都已有可直接使用的入口

### 2.9 自动化测试已补齐到当前阶段

已完成：

- `local_hub_v2` 测试通过
- 真实 adapter 测试通过
- 扩展当前保留的稳定测试通过

结果：

- 当前变更已具备基本回归保护

---

## 3. 当前仍未完成的部分

虽然主链路已经打通，但还没有完全进入“稳定可长期使用”的状态。

当前最关键的未完成项是：

### 3.1 真实执行失败场景还没有系统化收敛

还需要补：

- adapter 超时处理
- `codex exec` 执行失败分类
- 部分回传 / 空回传 / 非法回传处理
- `needs_review` 与 `blocked` 的更清晰边界

### 3.2 ChatGPT 回传链路还缺最终人工验收记录

虽然工程实现已经完成，但仍需要补一份标准人工验收，确认：

- 扩展真实抓包
- 自动 dispatch
- 真实 Codex 执行
- popup 状态更新
- ChatGPT 收到 `local-hub-context`

这些步骤在真实浏览器里都能稳定观察到。

### 3.3 Git 提交面还需要清理

当前仓库里仍存在一些不适合继续跟踪的内容，例如：

- `chatgpt-codex-bridge-edge-v1.1/node_modules`
- `local_hub_v2/.runtime`
- 其他本地产物

这些需要在提交前继续清理索引。

---

## 4. 当前阶段判断

到这一步为止，可以明确判断：

- 阶段 A：真实 Local Adapter，已完成
- 阶段 B：浏览器扩展 <-> Hub 联调，已完成
- 阶段 B 补强：自动 dispatch 开关与 ChatGPT 回传闭环，已完成
- 阶段 C：真实执行下的错误与审查机制，尚未系统化完成

所以当前最合理的判断是：

**Local Hub V2 已经完成“真实默认执行闭环”，下一阶段不应再扩范围，而应重点提升稳定性、失败可诊断性和最终人工验收完整度。**

---

## 5. 下一阶段总目标

下一阶段的总目标应定义为：

**把 Local Hub V2 从“真实链路已经跑通”推进到“失败边界清晰、人工审查明确、可以稳定持续使用”的本地执行编排器。**

---

## 6. 下一阶段工作规划

### 阶段 C：完善真实执行下的错误与审查机制

目标：

- 让真实执行失败时，Hub 能稳定进入正确状态
- 让人能快速判断“是否可继续、是否需要人工介入”

核心工作：

- 补齐真实 adapter 的失败分类：
  - 启动失败
  - 执行超时
  - 模型返回非法 JSON
  - 没有生成输出文件
  - Hub 回传失败
- 细化状态归类规则：
  - `completed`
  - `needs_review`
  - `blocked`
- 统一 `run.json / ProjectState / dispatch.log / context pack` 中的失败语义
- 让 popup 对失败状态有更明确展示

验收标准：

- 失败时不会静默
- 日志、状态、错误原因三者一致
- 人可以根据状态与日志判断下一步动作

### 阶段 C.5：补最终人工验收记录

目标：

- 把已经完成的真实链路形成标准验收步骤

核心工作：

- 在真实 Edge + ChatGPT 页面完成一轮完整人工验证
- 记录以下可观察点：
  - packet 被扩展捕获
  - Hub 自动或手动 dispatch
  - run 状态推进
  - popup 展示 execution/context
  - ChatGPT 收到 `local-hub-context`
  - ChatGPT 停在等待下一步指令，而不是自行继续乱跑

验收标准：

- 有一份明确的人工验收记录
- 后续任何人都能按步骤复现

### 阶段 D：清理提交面并准备入库

目标：

- 让当前仓库进入可提交、可推送、可持续维护状态

核心工作：

- 从 Git 索引移除不应继续跟踪的依赖和运行产物
- 检查 `.gitignore` 是否覆盖完整
- 整理一次提交说明

验收标准：

- `git status` 只剩应提交的源码和文档
- 不再把 `node_modules`、runtime、workflow 产物带进版本库

---

## 7. 下一阶段具体任务清单

建议按这个顺序继续执行：

1. 为真实 adapter 增加超时与失败分类处理。
2. 为 Hub 增加更明确的 `needs_review / blocked` 判定逻辑。
3. 在 popup 中补充失败状态的更清晰提示。
4. 用真实浏览器做一轮“抓包 -> 执行 -> 回传 ChatGPT”的完整人工验收。
5. 把人工验收结果再写成一份新的阶段记录。
6. 清理 Git 索引中的 `node_modules`、runtime 与其他本地产物。
7. 整理并提交当前阶段代码。

---

## 8. 当前最值得继续投入的方向

当前不建议优先投入：

- GUI 外壳扩张
- 云端统一中心
- 远程 worker 实装
- 多人协作能力

当前最值得继续投入的方向仍然是：

**把真实执行失败边界做清楚，把人工审查流程做清楚，把这条本地闭环打磨到稳定可持续使用。**
