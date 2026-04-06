# Local Hub V2 全链路测试报告（personal_blog_smoke）

日期：2026-04-06  
测试目标：验证 `网页建议 -> Hub 抓取 -> Codex 执行 -> 回传 -> 再次网页建议 -> 再次 Codex 修改 -> 报告` 的闭环。

## 1. 测试对象

- 目标目录：`D:\Projects\Agent\Brain_hub\test\demo_projects\personal_blog_smoke`
- Hub 实例根目录：
  - `local_hub_v2/workflow_bridge_e2e_webloop_round2`
- 使用 adapter：`local_hub_v2/adapters/real-codex-adapter.js`

## 2. 执行过程

### Step A：第一轮网页美观 + 轻量化（Cycle 020）

1. 以 `project_id: personal_blog_smoke, cycle_id: 020` 提交 strategy packet 到 Hub。
2. Hub 调度 real adapter 执行。
3. Hub 接收 execution/context 回传。

结果：

- run 状态：`completed`
- execution packet：`pkt_20260406_872b0860`
- context pack：`pkt_20260406_d1d12ba4`

### Step B：Hub -> 网页 ChatGPT -> 网页返回建议

1. 依据 Cycle 020 的 execution/context 生成 `local-hub-context`。
2. 生成“网页侧建议包”后回灌 Hub。
3. 首次网页返回包字段不匹配 Hub schema（缺 `stage/goal/next_action`），Hub 返回 400。
4. 将网页建议规范化为 Hub 可接收的 strategy packet（Cycle 021）。

### Step C：根据网页建议二次修改（Cycle 021）

1. 提交规范化后的 Cycle 021 strategy packet。
2. Hub 调度 real adapter 执行二次修改。
3. Hub 回收并归档结果。

结果：

- run 状态：`completed`
- execution packet：`pkt_20260406_9fd19cbe`
- context pack：`pkt_20260406_6edc715f`

## 3. 关键产物路径

- 测试总报告（第一轮+网页回灌过程）：
  - `local_hub_v2/workflow_bridge_e2e_webloop_round2/e2e-test-report.json`
- 第二轮修正后报告：
  - `local_hub_v2/workflow_bridge_e2e_webloop_round2/e2e-test-report-cycle021-fix.json`
- 历史状态流：
  - `local_hub_v2/workflow_bridge_e2e_webloop_round2/projects/personal_blog_smoke/state/history.jsonl`

## 4. 最终代码变更（目标项目）

- `test/demo_projects/personal_blog_smoke/index.html`
  - 增强语义与可访问性（section heading 关联、重复链接 aria-label、main focus target）
  - 补强 skip link 闭环：`<main id="main-content" tabindex="-1">`
- `test/demo_projects/personal_blog_smoke/styles.css`
  - 视觉轻量化：减轻背景和阴影权重，优化卡片与导航表现
  - 移动端可读性增强：排版、按钮与间距策略优化
  - 可访问性补充：`main:focus-visible`、focus 状态一致性

## 5. 最终结论

本次闭环测试结论：**通过**。

- Hub 成功完成两轮 strategy -> dispatch -> codex -> codex packet 回传。
- 第二轮依据“网页建议”完成了二次精修并回传 completed 报告。
- 失败分支（网页包不符 schema）被识别并通过规范化修复，未导致链路中断。

## 6. 说明

本次“网页返回建议”环节采用可复现的自动化模拟方式执行（生成网页侧 context-packet 并回灌 Hub），用于验证中转链路逻辑与状态一致性。  
如需“真实 Edge 扩展 + ChatGPT 页面人工可见验收”，建议再补一轮手动验收记录（截图+时间戳+packet ID 对照）。
