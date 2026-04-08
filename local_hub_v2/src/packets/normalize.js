import { createPacketId, nowIso } from "../utils/id.js";
import {
  assertValid,
  normalizeStringArray,
  validateCodexPayload,
  validateStrategyParsed,
} from "./schema.js";
import { parseStrategyPacket } from "./parse.js";

function normalizeExecutionReport(report) {
  if (!report) {
    return null;
  }
  return {
    changed_files: normalizeStringArray(report.changed_files),
    summary: normalizeStringArray(report.summary),
    verification: normalizeStringArray(report.verification),
    open_issues: normalizeStringArray(report.open_issues),
    risks: normalizeStringArray(report.risks),
    next_step:
      typeof report.next_step === "string" ? report.next_step.trim() : "",
  };
}

function normalizeContextPack(contextPack) {
  if (!contextPack) {
    return null;
  }
  return {
    current_goal:
      typeof contextPack.current_goal === "string"
        ? contextPack.current_goal.trim()
        : "",
    completed: normalizeStringArray(contextPack.completed),
    key_files: normalizeStringArray(contextPack.key_files),
    latest_verification: normalizeStringArray(contextPack.latest_verification),
    open_questions: normalizeStringArray(contextPack.open_questions),
    risks: normalizeStringArray(contextPack.risks),
    suggested_next_step:
      typeof contextPack.suggested_next_step === "string"
        ? contextPack.suggested_next_step.trim()
        : "",
    web_recovery_prompt:
      typeof contextPack.web_recovery_prompt === "string"
        ? contextPack.web_recovery_prompt.trim()
        : "",
  };
}

function deriveRunStatus(requestedStatus, executionReport, contextPack) {
  if (requestedStatus === "blocked") {
    return "blocked";
  }
  const risks = executionReport?.risks ?? contextPack?.risks ?? [];
  if (requestedStatus === "needs_review") {
    return "needs_review";
  }
  if (!contextPack || risks.length > 0) {
    return "needs_review";
  }
  return requestedStatus || "completed";
}

export function normalizeWebPacket({ packetText, source, meta }) {
  const parsed = parseStrategyPacket(packetText);
  const normalized = assertValid(validateStrategyParsed(parsed));
  const createdAt = nowIso();

  return {
    packet_id: createPacketId("pkt"),
    packet_version: "v1",
    packet_type: "strategy",
    project_id: normalized.project_id,
    cycle_id: normalized.cycle_id,
    stage: "strategy",
    source,
    parent_packet_id: null,
    created_at: createdAt,
    status: "pending",
    raw_text: String(packetText),
    parsed: normalized,
    meta: meta ?? {},
  };
}

export function normalizeCodexSubmission(body) {
  const normalized = assertValid(validateCodexPayload(body));
  const createdAt = nowIso();
  const executionReport = normalizeExecutionReport(normalized.execution_report);
  const contextPack = normalizeContextPack(normalized.context_pack);
  const finalStatus = deriveRunStatus(
    normalized.status,
    executionReport,
    contextPack
  );

  const executionPacket = executionReport
    ? {
        packet_id: createPacketId("pkt"),
        packet_version: "v1",
        packet_type: "execution",
        project_id: normalized.project_id,
        cycle_id: normalized.cycle_id,
        stage: "execution",
        source: normalized.source,
        parent_packet_id: null,
        created_at: createdAt,
        status: finalStatus,
        raw_text: JSON.stringify(executionReport, null, 2),
        parsed: executionReport,
        meta: {},
      }
    : null;

  const contextPacket = contextPack
    ? {
        packet_id: createPacketId("pkt"),
        packet_version: "v1",
        packet_type: "context",
        project_id: normalized.project_id,
        cycle_id: normalized.cycle_id,
        stage: "context",
        source: normalized.source,
        parent_packet_id: executionPacket?.packet_id ?? null,
        created_at: createdAt,
        status: finalStatus,
        raw_text: JSON.stringify(contextPack, null, 2),
        parsed: contextPack,
        meta: {},
      }
    : null;

  return {
    projectId: normalized.project_id,
    cycleId: normalized.cycle_id,
    requestedStatus: normalized.status,
    finalStatus,
    executionPacket,
    contextPacket,
    codexSessionId: normalized.codex_session_id,
  };
}
