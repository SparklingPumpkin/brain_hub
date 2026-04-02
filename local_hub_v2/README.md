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

## 运行

```bash
npm start
```

默认监听 `127.0.0.1:8765`。

## 测试

```bash
npm test
```
