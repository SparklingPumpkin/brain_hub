import { createRunId, nowIso } from "../utils/id.js";

export function createRunRecord({
  projectId,
  cycleId,
  strategyPacketId,
  dispatchMode,
}) {
  const timestamp = nowIso();
  return {
    run_id: createRunId(projectId, cycleId),
    project_id: projectId,
    cycle_id: cycleId,
    status: "pending",
    strategy_packet_id: strategyPacketId,
    execution_packet_id: null,
    context_pack_id: null,
    dispatch_mode: dispatchMode,
    assigned_worker: null,
    attempt_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
    last_error: null,
  };
}

export function refreshRunForStrategy(existingRun, strategyPacketId, dispatchMode) {
  const timestamp = nowIso();
  if (!existingRun) {
    return null;
  }

  return {
    ...existingRun,
    status: "pending",
    strategy_packet_id: strategyPacketId,
    dispatch_mode: dispatchMode,
    updated_at: timestamp,
    last_error: null,
  };
}

export function markRunDispatched(runRecord) {
  return {
    ...runRecord,
    status: "dispatched",
    attempt_count: runRecord.attempt_count + 1,
    updated_at: nowIso(),
    last_error: null,
  };
}

export function markRunRunning(runRecord) {
  return {
    ...runRecord,
    status: "running",
    updated_at: nowIso(),
  };
}

export function markRunFailed(runRecord, status, errorMessage) {
  return {
    ...runRecord,
    status,
    updated_at: nowIso(),
    last_error: errorMessage,
  };
}

export function attachCodexResults(
  runRecord,
  { executionPacketId, contextPackId, status }
) {
  return {
    ...runRecord,
    execution_packet_id: executionPacketId ?? runRecord.execution_packet_id,
    context_pack_id: contextPackId ?? runRecord.context_pack_id,
    status,
    updated_at: nowIso(),
    last_error: null,
  };
}
