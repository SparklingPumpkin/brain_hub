# Local Hub V2 本轮完成说明（真实 Codex CLI Adapter）

日期：2026-04-02  
范围：在 `local_hub_v2` 中接入真实 Codex CLI adapter（保留 mock adapter），并完成真实 demo 闭环验证。

---

## 1. 本轮目标与结果

本轮目标已完成：

1. 新建真实 adapter，保留 mock adapter。
2. 真实 adapter 读取 `strategy.packet.json`，调用 `codex exec`。
3. 执行后生成 execution report 与 context pack。
4. 通过 `POST /packets/codex` 回传 Hub。
5. 增加成功路径与失败路径自动化测试（均通过）。
6. 选用真实 demo 项目完成一次完整闭环验证（成功）。

---

## 2. 实际调用方式

### 2.1 Hub 配置中的 adapter 命令

当前默认命令（`hub.config.json`）：

```bash
node ./adapters/real-codex-adapter.js --workspace ./demo_projects/mini_math
```

### 2.2 由 Hub 调用 adapter 的完整参数形态

Hub dispatch 时会追加参数：

```bash
node ./adapters/real-codex-adapter.js \
  --workspace ./demo_projects/mini_math \
  --input <.../strategy.packet.json> \
  --hub http://127.0.0.1:<port> \
  --project <project_id> \
  --cycle <cycle_id>
```

### 2.3 real adapter 内部调用 Codex CLI 的形态

```bash
codex exec \
  --skip-git-repo-check \
  -C <workspace> \
  --sandbox workspace-write \
  --output-schema ./adapters/schemas/codex-exec-output.schema.json \
  -o <tmp_output_file> \
  "<prompt built from strategy packet>"
```

执行后 adapter 读取 `-o` 产物 JSON，标准化后回传：

`POST /packets/codex`

---

## 3. 涉及文件

### 3.1 新增

- `local_hub_v2/adapters/real-codex-adapter.js`
- `local_hub_v2/adapters/schemas/codex-exec-output.schema.json`
- `local_hub_v2/test/real-adapter.e2e.test.js`
- `local_hub_v2/test/fixtures/fake-codex-cli.js`
- `local_hub_v2/demo_projects/mini_math/package.json`
- `local_hub_v2/demo_projects/mini_math/src/sum.js`
- `local_hub_v2/demo_projects/mini_math/test/sum.test.js`

### 3.2 修改

- `local_hub_v2/hub.config.json`
- `local_hub_v2/src/config.js`
- `local_hub_v2/package.json`
- `local_hub_v2/README.md`

---

## 4. 测试与验证结果

### 4.1 自动化测试

命令：

```bash
npm test
```

结果：3/3 通过

- mock adapter 闭环测试通过
- real adapter 成功路径测试通过（fake codex CLI）
- real adapter 失败路径测试通过（fake codex CLI）

### 4.2 真实 demo 闭环验证

demo 项目：`local_hub_v2/demo_projects/mini_math`  
真实 run：

- `project_id = mini_math_real_demo`
- `cycle_id = 001`
- Hub 最终状态：`completed`

真实执行后 demo 项目变更：

- `src/sum.js` 新增并导出 `multiply(a, b)`
- `package.json` 的 test script 被 Codex 调整为 `node --test --test-isolation=none`

验证命令：

```bash
cd local_hub_v2/demo_projects/mini_math
npm test
```

结果：2 pass / 0 fail

---

## 5. 成功样例 packet

来源文件（execution）：

`local_hub_v2/workflow_bridge_validation/projects/mini_math_real_demo/packets/execution/pkt_20260402_c0723bab.json`

关键内容（节选）：

```json
{
  "project_id": "mini_math_real_demo",
  "cycle_id": "001",
  "status": "completed",
  "source": "codex-real-adapter",
  "parsed": {
    "changed_files": [
      "D:\\Projects\\Agent\\Brain_hub\\local_hub_v2\\demo_projects\\mini_math\\src\\sum.js",
      "D:\\Projects\\Agent\\Brain_hub\\local_hub_v2\\demo_projects\\mini_math\\package.json"
    ],
    "summary": [
      "Added and exported `multiply(a, b)` in `src/sum.js`.",
      "Adjusted test script to `node --test --test-isolation=none` so `npm test` runs in this environment.",
      "All tests now pass."
    ],
    "verification": [
      "Ran `npm test` in `D:\\Projects\\Agent\\Brain_hub\\local_hub_v2\\demo_projects\\mini_math` with 2 passing, 0 failing."
    ],
    "open_issues": [],
    "risks": []
  }
}
```

---

## 6. 失败样例 packet

来源文件（execution）：

`local_hub_v2/workflow_bridge_validation_fail/projects/mini_math_real_fail_demo/packets/execution/pkt_20260402_e4ce3a22.json`

失败触发方式：故意将 adapter 的 `--codex-cmd` 配置为不可执行命令 `codex_not_exists`。

关键内容（节选）：

```json
{
  "project_id": "mini_math_real_fail_demo",
  "cycle_id": "001",
  "status": "blocked",
  "source": "codex-real-adapter",
  "parsed": {
    "summary": [
      "Codex CLI execution failed before completion."
    ],
    "open_issues": [
      "spawn codex_not_exists ENOENT"
    ],
    "risks": [
      "spawn codex_not_exists ENOENT"
    ],
    "next_step": "manual_review_required"
  }
}
```

---

## 7. 当前限制

1. real adapter 当前依赖 `codex exec` 可用性与认证状态；网络或认证异常会进入 `blocked`。
2. `changed_files` 的兜底基于 `git status --porcelain -uall`，在未提交基线或非 git 工作区时精度受限。
3. 当前 prompt 与 schema 是通用模板，尚未引入针对不同项目类型的 specialized prompt profile。
4. 失败路径目前统一归并为 `blocked` 并回传，尚未细分“可自动重试”与“必须人工确认”。

---

## 8. 下一步建议

1. 给 real adapter 增加重试策略与可配置重试上限（仅对可恢复错误生效）。
2. 增加 `execution_report` 的结构化验证（例如命令耗时、测试通过率、修改文件白名单校验）。
3. 为 demo/生产项目加入“允许修改路径”约束（adapter 前置检查 + 回传校验）。
4. 增加一条真实 Codex CLI 的 nightly smoke 测试（非 fake），持续验证端到端可用性。
