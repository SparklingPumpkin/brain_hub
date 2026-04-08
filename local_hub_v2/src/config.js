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
  default_project_workdir_root: null,
  project_workdirs: {},
  default_session_mode: "new",
  remote_control_enabled: false,
  remote_control_token: null,
  remote_control_title: "Local Hub Remote",
};

function resolveOptionalPath(projectRoot, value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return path.resolve(projectRoot, value);
}

function normalizeProjectWorkdirs(projectRoot, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([projectId, workdir]) => [
        String(projectId).trim(),
        resolveOptionalPath(projectRoot, workdir),
      ])
      .filter(([projectId, workdir]) => projectId && workdir)
  );
}

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
    defaultProjectWorkdirRoot: resolveOptionalPath(
      projectRoot,
      merged.defaultProjectWorkdirRoot ??
        merged.default_project_workdir_root ??
        DEFAULT_CONFIG.default_project_workdir_root
    ),
    projectWorkdirs: normalizeProjectWorkdirs(
      projectRoot,
      merged.projectWorkdirs ??
        merged.project_workdirs ??
        DEFAULT_CONFIG.project_workdirs
    ),
    defaultSessionMode:
      merged.defaultSessionMode ??
      merged.default_session_mode ??
      DEFAULT_CONFIG.default_session_mode,
    remoteControlEnabled: Boolean(
      merged.remoteControlEnabled ??
        merged.remote_control_enabled ??
        DEFAULT_CONFIG.remote_control_enabled
    ),
    remoteControlToken:
      merged.remoteControlToken ??
      merged.remote_control_token ??
      DEFAULT_CONFIG.remote_control_token,
    remoteControlTitle:
      merged.remoteControlTitle ??
      merged.remote_control_title ??
      DEFAULT_CONFIG.remote_control_title,
  };
  config.hubUrl = `http://${config.host}:${config.port}`;
  return config;
}
