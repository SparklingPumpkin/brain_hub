import { HttpError } from "../utils/errors.js";
import {
  attachCodexResults,
  markRunDispatched,
  markRunFailed,
  markRunRunning,
} from "../state/run-state.js";
import { createHistoryEntry, deriveProjectState } from "../state/project-state.js";
import { runLocalAdapter } from "./local-adapter.js";
import { enqueueRemoteDispatch } from "./remote-queue.js";

function logEntry(level, runRecord, event, message, extra = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    project_id: runRecord.project_id,
    cycle_id: runRecord.cycle_id,
    run_id: runRecord.run_id,
    event,
    message,
    ...extra,
  };
}

export async function dispatchToCodex(context, { projectId, cycleId }) {
  const { store, config, logger } = context;
  const currentRun = await store.getRunRecord(projectId, cycleId);

  if (!currentRun) {
    throw new HttpError(404, "Run not found");
  }

  if (currentRun.status === "running") {
    return currentRun;
  }

  const dispatchedRun = markRunDispatched(currentRun);
  await store.saveRunRecord(dispatchedRun);
  await store.saveProjectState(deriveProjectState(await store.getProjectState(projectId), dispatchedRun));
  await store.appendProjectHistory(
    projectId,
    createHistoryEntry("run_dispatched", dispatchedRun)
  );
  await store.appendDispatchLog(
    projectId,
    cycleId,
    logEntry("info", dispatchedRun, "dispatch", "Dispatch requested", {
      dispatch_mode: dispatchedRun.dispatch_mode,
    })
  );

  if (dispatchedRun.dispatch_mode === "remote_worker") {
    await enqueueRemoteDispatch(store, dispatchedRun);
    return dispatchedRun;
  }

  const runningRun = markRunRunning(dispatchedRun);
  await store.saveRunRecord(runningRun);
  await store.saveProjectState(deriveProjectState(await store.getProjectState(projectId), runningRun));
  await store.appendProjectHistory(
    projectId,
    createHistoryEntry("run_running", runningRun)
  );
  await store.appendDispatchLog(
    projectId,
    cycleId,
    logEntry("info", runningRun, "dispatch", "Local adapter started")
  );

  try {
    const projectState = await store.getProjectState(projectId);
    const effectiveSessionMode =
      currentRun.session_mode ?? config.defaultSessionMode ?? "new";
    const effectiveSessionId =
      effectiveSessionMode === "project"
        ? projectState?.latest_codex_session_id ?? null
        : currentRun.session_id ?? null;

    await runLocalAdapter({
      config,
      inputPath: store.getRunStrategyPacketPath(projectId, cycleId),
      projectId,
      cycleId,
      sessionMode: effectiveSessionMode,
      sessionId: effectiveSessionId,
    });
    const latestRun = await store.getRunRecord(projectId, cycleId);
    return latestRun ?? runningRun;
  } catch (error) {
    const failedStatus = config.approvalPolicy === "manual_on_risk" ? "needs_review" : "blocked";
    const failedRun = markRunFailed(runningRun, failedStatus, error.message);
    await store.saveRunRecord(failedRun);
    await store.saveProjectState(deriveProjectState(await store.getProjectState(projectId), failedRun));
    await store.appendProjectHistory(
      projectId,
      createHistoryEntry("dispatch_failed", failedRun, { error: error.message })
    );
    await store.appendDispatchLog(
      projectId,
      cycleId,
      logEntry("error", failedRun, "dispatch_failed", "Local adapter failed", {
        error: error.message,
      })
    );
    logger.error("Dispatch failed", {
      project_id: projectId,
      cycle_id: cycleId,
      error: error.message,
    });
    return failedRun;
  }
}
