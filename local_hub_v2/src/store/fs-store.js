import fs from "node:fs/promises";
import { appendLine, ensureDir, readJsonIfExists, writeJson } from "../utils/json.js";
import { createPaths } from "./paths.js";

const RUN_PACKET_FILES = {
  strategy: "strategyPacketFile",
  execution: "executionPacketFile",
  context: "contextPackFile",
};

export function createFsStore(rootDir) {
  const paths = createPaths(rootDir);

  return {
    rootDir,
    paths,
    async init() {
      await ensureDir(paths.projectsRoot);
      await ensureDir(paths.queueRoot);
      await ensureDir(paths.tmpRoot);
      await ensureDir(paths.queuePendingFile("placeholder").replace(/placeholder\.json$/, ""));
      await ensureDir(`${paths.queueRoot}/claimed`);
      await ensureDir(`${paths.queueRoot}/done`);
    },
    async ensureProject(projectId, cycleId) {
      const projectPaths = paths.project(projectId);
      const runPaths = projectPaths.run(cycleId);
      await Promise.all([
        ensureDir(projectPaths.packetDir("strategy")),
        ensureDir(projectPaths.packetDir("execution")),
        ensureDir(projectPaths.packetDir("context")),
        ensureDir(projectPaths.runsRoot),
        ensureDir(runPaths.root),
        ensureDir(projectPaths.stateRoot),
        ensureDir(projectPaths.exportsRoot),
        ensureDir(projectPaths.logsRoot),
      ]);
    },
    async savePacketRecord(packetRecord) {
      await this.ensureProject(packetRecord.project_id, packetRecord.cycle_id);
      const projectPaths = paths.project(packetRecord.project_id);
      const archiveFile = projectPaths.packetFile(
        packetRecord.packet_type,
        packetRecord.packet_id
      );
      const runPaths = projectPaths.run(packetRecord.cycle_id);
      const runPacketFile = runPaths[RUN_PACKET_FILES[packetRecord.packet_type]];
      await writeJson(archiveFile, packetRecord);
      await writeJson(runPacketFile, packetRecord);
      return archiveFile;
    },
    async getPacketRecord(projectId, packetType, packetId) {
      return readJsonIfExists(paths.project(projectId).packetFile(packetType, packetId));
    },
    async saveRunRecord(runRecord) {
      await this.ensureProject(runRecord.project_id, runRecord.cycle_id);
      await writeJson(
        paths.project(runRecord.project_id).run(runRecord.cycle_id).runFile,
        runRecord
      );
    },
    async getRunRecord(projectId, cycleId) {
      return readJsonIfExists(paths.project(projectId).run(cycleId).runFile);
    },
    async saveProjectState(projectState) {
      await this.ensureProject(projectState.project_id, projectState.active_cycle_id);
      await writeJson(
        paths.project(projectState.project_id).currentStateFile,
        projectState
      );
    },
    async getProjectState(projectId) {
      return readJsonIfExists(paths.project(projectId).currentStateFile);
    },
    async appendProjectHistory(projectId, entry) {
      await appendLine(
        paths.project(projectId).historyFile,
        JSON.stringify(entry)
      );
    },
    async appendDispatchLog(projectId, cycleId, entry) {
      await appendLine(
        paths.project(projectId).run(cycleId).dispatchLogFile,
        JSON.stringify(entry)
      );
    },
    async enqueuePendingRun(runRecord) {
      await writeJson(paths.queuePendingFile(runRecord.run_id), runRecord);
    },
    getRunStrategyPacketPath(projectId, cycleId) {
      return paths.project(projectId).run(cycleId).strategyPacketFile;
    },
    async getLatestExecution(projectId) {
      const state = await this.getProjectState(projectId);
      if (!state?.latest_execution_packet_id) {
        return null;
      }
      return this.getPacketRecord(
        projectId,
        "execution",
        state.latest_execution_packet_id
      );
    },
    async getLatestContextPack(projectId) {
      const state = await this.getProjectState(projectId);
      if (!state?.latest_context_pack_id) {
        return null;
      }
      return this.getPacketRecord(projectId, "context", state.latest_context_pack_id);
    },
    async listProjectStates() {
      try {
        const entries = await fs.readdir(paths.projectsRoot, { withFileTypes: true });
        const states = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }
          const state = await readJsonIfExists(
            paths.project(entry.name).currentStateFile
          );
          if (state) {
            states.push(state);
          }
        }
        return states.sort((left, right) =>
          String(right.last_updated_at ?? "").localeCompare(
            String(left.last_updated_at ?? "")
          )
        );
      } catch (error) {
        if (error.code === "ENOENT") {
          return [];
        }
        throw error;
      }
    },
  };
}
