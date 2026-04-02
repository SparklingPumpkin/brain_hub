import path from "node:path";

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function createPaths(rootDir) {
  return {
    rootDir,
    projectsRoot: path.join(rootDir, "projects"),
    queueRoot: path.join(rootDir, "queue"),
    tmpRoot: path.join(rootDir, "tmp"),
    project(projectId) {
      const safeProjectId = safeSegment(projectId);
      const projectRoot = path.join(rootDir, "projects", safeProjectId);
      return {
        root: projectRoot,
        packetsRoot: path.join(projectRoot, "packets"),
        packetDir(packetType) {
          return path.join(projectRoot, "packets", packetType);
        },
        packetFile(packetType, packetId) {
          return path.join(
            projectRoot,
            "packets",
            packetType,
            `${safeSegment(packetId)}.json`
          );
        },
        runsRoot: path.join(projectRoot, "runs"),
        run(cycleId) {
          const safeCycleId = safeSegment(cycleId);
          const runRoot = path.join(projectRoot, "runs", safeCycleId);
          return {
            root: runRoot,
            runFile: path.join(runRoot, "run.json"),
            strategyPacketFile: path.join(runRoot, "strategy.packet.json"),
            executionPacketFile: path.join(runRoot, "execution.packet.json"),
            contextPackFile: path.join(runRoot, "context.pack.json"),
            dispatchLogFile: path.join(runRoot, "dispatch.log"),
          };
        },
        stateRoot: path.join(projectRoot, "state"),
        currentStateFile: path.join(projectRoot, "state", "current.json"),
        historyFile: path.join(projectRoot, "state", "history.jsonl"),
        exportsRoot: path.join(projectRoot, "exports"),
        logsRoot: path.join(projectRoot, "logs"),
      };
    },
    queuePendingFile(runId) {
      return path.join(rootDir, "queue", "pending", `${safeSegment(runId)}.json`);
    },
  };
}
