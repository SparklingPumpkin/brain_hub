import path from "node:path";
import { readJsonIfExists } from "./utils/json.js";

const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 8765,
  root_dir: "./workflow_bridge",
  auto_dispatch: false,
  default_dispatch_mode: "local_adapter",
  codex_adapter_cmd: "node ./adapters/mock-codex-adapter.js",
  allow_remote_worker: false,
  approval_policy: "manual_on_risk",
  log_level: "info",
  version: "v2-alpha",
};

export async function loadConfig({
  configPath = path.resolve(process.cwd(), "hub.config.json"),
  overrides = {},
} = {}) {
  const fileConfig = (await readJsonIfExists(configPath)) ?? {};
  const projectRoot = overrides.projectRoot ?? path.dirname(configPath);
  const merged = { ...DEFAULT_CONFIG, ...fileConfig, ...overrides };
  const rootDirValue = merged.rootDir ?? merged.root_dir ?? DEFAULT_CONFIG.root_dir;
  const config = {
    ...merged,
    projectRoot,
    host: String(merged.host ?? DEFAULT_CONFIG.host),
    port: Number(merged.port ?? DEFAULT_CONFIG.port),
    rootDir: path.resolve(projectRoot, rootDirValue),
    autoDispatch: Boolean(merged.autoDispatch ?? merged.auto_dispatch),
    defaultDispatchMode:
      merged.defaultDispatchMode ??
      merged.default_dispatch_mode ??
      DEFAULT_CONFIG.default_dispatch_mode,
    codexAdapterCommand:
      merged.codexAdapterCommand ??
      merged.codex_adapter_cmd ??
      DEFAULT_CONFIG.codex_adapter_cmd,
    allowRemoteWorker: Boolean(
      merged.allowRemoteWorker ?? merged.allow_remote_worker
    ),
    approvalPolicy:
      merged.approvalPolicy ??
      merged.approval_policy ??
      DEFAULT_CONFIG.approval_policy,
    logLevel: merged.logLevel ?? merged.log_level ?? DEFAULT_CONFIG.log_level,
    version: String(merged.version ?? DEFAULT_CONFIG.version),
  };
  config.hubUrl = `http://${config.host}:${config.port}`;
  return config;
}
