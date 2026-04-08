import { dispatchToCodex } from "../dispatch/dispatcher.js";
import { normalizeWebPacket } from "../packets/normalize.js";
import { createHistoryEntry, deriveProjectState } from "../state/project-state.js";
import { createRunRecord, refreshRunForStrategy } from "../state/run-state.js";
import { assertRemoteAuthorized } from "../remote/auth.js";
import { buildRemotePanelHtml } from "../remote/panel-html.js";
import { HttpError } from "../utils/errors.js";

function buildStrategyPacketText({ projectId, cycleId, goal, constraints, sessionMode, sessionId }) {
  const lines = [
    `project_id: ${projectId}`,
    `cycle_id: ${cycleId}`,
    "stage: strategy",
    `goal: ${goal}`,
    "constraints:",
  ];

  for (const constraint of constraints) {
    lines.push(`  - ${constraint}`);
  }

  if (constraints.length === 0) {
    lines.push("  - No additional constraints");
  }

  if (sessionMode) {
    lines.push(`session_mode: ${sessionMode}`);
  }

  if (sessionId) {
    lines.push(`session_id: ${sessionId}`);
  }

  lines.push("next_action: codex_execute");
  return lines.join("\n");
}

async function saveStrategyPacket(context, packetRecord) {
  const existingRun = await context.store.getRunRecord(
    packetRecord.project_id,
    packetRecord.cycle_id
  );
  const runRecord =
    refreshRunForStrategy(
      existingRun,
      packetRecord.packet_id,
      context.config.defaultDispatchMode,
      packetRecord.parsed.session_mode,
      packetRecord.parsed.session_id
    ) ??
    createRunRecord({
      projectId: packetRecord.project_id,
      cycleId: packetRecord.cycle_id,
      strategyPacketId: packetRecord.packet_id,
      dispatchMode: context.config.defaultDispatchMode,
      sessionMode: packetRecord.parsed.session_mode,
      sessionId: packetRecord.parsed.session_id,
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
      source: "remote_panel",
    })
  );

  return runRecord;
}

export async function handleRemotePanel(context, request) {
  if (!context.config.remoteControlEnabled) {
    throw new HttpError(404, "Remote control is disabled");
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: buildRemotePanelHtml(context.config.remoteControlTitle),
  };
}

export async function handleRemoteOverview(context, request) {
  assertRemoteAuthorized(context, request);
  const projects = await context.store.listProjectStates();
  return {
    ok: true,
    projects,
  };
}

export async function handleRemoteProject(context, request, projectId) {
  assertRemoteAuthorized(context, request);
  const state = await context.store.getProjectState(projectId);
  if (!state) {
    throw new HttpError(404, "Project state not found");
  }
  return {
    ok: true,
    state,
    latest_execution: await context.store.getLatestExecution(projectId),
    latest_context_pack: await context.store.getLatestContextPack(projectId),
  };
}

export async function handleRemoteTask(context, request) {
  assertRemoteAuthorized(context, request);
  const body = request.body ?? {};
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
  const cycleId = typeof body.cycle_id === "string" ? body.cycle_id.trim() : "";
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const sessionMode =
    typeof body.session_mode === "string" && body.session_mode.trim()
      ? body.session_mode.trim()
      : context.config.defaultSessionMode;
  const sessionId =
    typeof body.session_id === "string" && body.session_id.trim()
      ? body.session_id.trim()
      : null;
  const constraints = Array.isArray(body.constraints)
    ? body.constraints.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!projectId || !cycleId || !goal) {
    throw new HttpError(400, "project_id, cycle_id, and goal are required");
  }

  const packetRecord = normalizeWebPacket({
    packetText: buildStrategyPacketText({
      projectId,
      cycleId,
      goal,
      constraints,
      sessionMode,
      sessionId,
    }),
    source: "remote-panel",
    meta: {
      submitted_via: "remote-api",
    },
  });

  const runRecord = await saveStrategyPacket(context, packetRecord);
  let finalRun = runRecord;
  if (body.auto_dispatch !== false) {
    finalRun = await dispatchToCodex(context, { projectId, cycleId });
  }

  return {
    ok: true,
    project_id: projectId,
    cycle_id: cycleId,
    run_id: finalRun.run_id,
    status: finalRun.status,
    packet_id: packetRecord.packet_id,
  };
}

export async function handleRemoteDispatch(context, request, projectId, cycleId) {
  assertRemoteAuthorized(context, request);
  const run = await dispatchToCodex(context, { projectId, cycleId });
  return {
    ok: true,
    run_id: run.run_id,
    status: run.status,
    attempt_count: run.attempt_count,
  };
}
