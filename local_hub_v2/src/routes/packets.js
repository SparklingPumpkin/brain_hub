import { normalizeCodexSubmission, normalizeWebPacket } from "../packets/normalize.js";
import { createHistoryEntry, deriveProjectState } from "../state/project-state.js";
import {
  attachCodexResults,
  createRunRecord,
  refreshRunForStrategy,
} from "../state/run-state.js";
import { dispatchToCodex } from "../dispatch/dispatcher.js";
import { HttpError } from "../utils/errors.js";

export async function handleWebPacket(context, body) {
  if (typeof body.packet !== "string" || body.packet.trim() === "") {
    throw new HttpError(400, "packet must be a non-empty string");
  }

  const packetRecord = normalizeWebPacket({
    packetText: body.packet,
    source: body.source ?? "web",
    meta: body.meta ?? {},
  });

  const existingRun = await context.store.getRunRecord(
    packetRecord.project_id,
    packetRecord.cycle_id
  );
  const runRecord =
    refreshRunForStrategy(
      existingRun,
      packetRecord.packet_id,
      context.config.defaultDispatchMode
    ) ??
    createRunRecord({
      projectId: packetRecord.project_id,
      cycleId: packetRecord.cycle_id,
      strategyPacketId: packetRecord.packet_id,
      dispatchMode: context.config.defaultDispatchMode,
    });

  await context.store.savePacketRecord(packetRecord);
  await context.store.saveRunRecord(runRecord);
  await context.store.saveProjectState(
    deriveProjectState(
      await context.store.getProjectState(packetRecord.project_id),
      runRecord
    )
  );
  await context.store.appendProjectHistory(
    packetRecord.project_id,
    createHistoryEntry("strategy_received", runRecord, {
      packet_id: packetRecord.packet_id,
    })
  );

  let finalRun = runRecord;
  if (context.config.autoDispatch) {
    finalRun = await dispatchToCodex(context, {
      projectId: packetRecord.project_id,
      cycleId: packetRecord.cycle_id,
    });
  }

  return {
    ok: true,
    packet_id: packetRecord.packet_id,
    run_id: finalRun.run_id,
    status: finalRun.status,
  };
}

export async function handleCodexPacket(context, body) {
  const normalized = normalizeCodexSubmission(body);
  const currentRun = await context.store.getRunRecord(
    normalized.projectId,
    normalized.cycleId
  );

  if (!currentRun) {
    throw new HttpError(404, "Run not found for codex packet");
  }

  if (normalized.executionPacket) {
    normalized.executionPacket.parent_packet_id = currentRun.strategy_packet_id;
    await context.store.savePacketRecord(normalized.executionPacket);
  }

  if (normalized.contextPacket) {
    normalized.contextPacket.parent_packet_id =
      normalized.executionPacket?.packet_id ?? currentRun.strategy_packet_id;
    await context.store.savePacketRecord(normalized.contextPacket);
  }

  const updatedRun = attachCodexResults(currentRun, {
    executionPacketId: normalized.executionPacket?.packet_id ?? null,
    contextPackId: normalized.contextPacket?.packet_id ?? null,
    status: normalized.finalStatus,
  });

  await context.store.saveRunRecord(updatedRun);
  await context.store.saveProjectState(
    deriveProjectState(
      await context.store.getProjectState(normalized.projectId),
      updatedRun
    )
  );
  await context.store.appendProjectHistory(
    normalized.projectId,
    createHistoryEntry("codex_result_received", updatedRun, {
      execution_packet_id: normalized.executionPacket?.packet_id ?? null,
      context_pack_id: normalized.contextPacket?.packet_id ?? null,
    })
  );
  await context.store.appendDispatchLog(
    normalized.projectId,
    normalized.cycleId,
    {
      timestamp: new Date().toISOString(),
      level: "info",
      project_id: normalized.projectId,
      cycle_id: normalized.cycleId,
      run_id: updatedRun.run_id,
      event: "codex_result_received",
      message: "Codex result accepted",
      status: updatedRun.status,
    }
  );

  return {
    ok: true,
    execution_packet_id: normalized.executionPacket?.packet_id ?? null,
    context_pack_id: normalized.contextPacket?.packet_id ?? null,
    run_status: updatedRun.status,
  };
}
