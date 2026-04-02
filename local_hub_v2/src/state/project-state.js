import { nowIso } from "../utils/id.js";

export function deriveProjectState(existingState, runRecord) {
  return {
    project_id: runRecord.project_id,
    active_cycle_id: runRecord.cycle_id,
    latest_strategy_packet_id:
      runRecord.strategy_packet_id ?? existingState?.latest_strategy_packet_id ?? null,
    latest_execution_packet_id:
      runRecord.execution_packet_id ??
      existingState?.latest_execution_packet_id ??
      null,
    latest_context_pack_id:
      runRecord.context_pack_id ?? existingState?.latest_context_pack_id ?? null,
    current_status: runRecord.status,
    last_updated_at: runRecord.updated_at ?? nowIso(),
  };
}

export function createHistoryEntry(event, runRecord, extra = {}) {
  return {
    timestamp: nowIso(),
    event,
    project_id: runRecord.project_id,
    cycle_id: runRecord.cycle_id,
    run_id: runRecord.run_id,
    status: runRecord.status,
    ...extra,
  };
}
