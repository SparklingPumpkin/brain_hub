import { HttpError } from "../utils/errors.js";

export const RUN_STATUSES = [
  "pending",
  "dispatched",
  "running",
  "completed",
  "blocked",
  "needs_review",
];

export const PACKET_TYPES = ["strategy", "execution", "context"];
export const SESSION_MODES = ["new", "resume", "project", "last"];

function requireString(value, fieldName, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${fieldName} is required`);
    return "";
  }
  return value.trim();
}

export function normalizeStringArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }
  return [String(value).trim()].filter(Boolean);
}

export function validateStrategyParsed(parsed) {
  const errors = [];
  const projectId = requireString(parsed.project_id, "project_id", errors);
  const cycleId = requireString(parsed.cycle_id, "cycle_id", errors);
  const stage = requireString(parsed.stage, "stage", errors);
  const goal = requireString(parsed.goal, "goal", errors);
  const nextAction = requireString(parsed.next_action, "next_action", errors);
  const sessionId =
    typeof parsed.session_id === "string" ? parsed.session_id.trim() : null;
  const rawSessionMode =
    typeof parsed.session_mode === "string" ? parsed.session_mode.trim() : "";
  const sessionMode = rawSessionMode || "new";

  if (stage && stage !== "strategy") {
    errors.push("stage must be strategy");
  }
  if (rawSessionMode && !SESSION_MODES.includes(rawSessionMode)) {
    errors.push(`session_mode must be one of: ${SESSION_MODES.join(", ")}`);
  }
  if (sessionId && sessionMode === "new") {
    errors.push("session_id requires session_mode resume or project");
  }
  if (sessionMode === "resume" && !sessionId) {
    errors.push("session_id is required when session_mode is resume");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      project_id: projectId,
      cycle_id: cycleId,
      stage: "strategy",
      goal,
      constraints: normalizeStringArray(parsed.constraints),
      next_action: nextAction,
      session_mode: sessionMode,
      session_id: sessionId,
    },
  };
}

export function validateCodexPayload(body) {
  const errors = [];
  const projectId = requireString(body.project_id, "project_id", errors);
  const cycleId = requireString(body.cycle_id, "cycle_id", errors);
  const source = requireString(body.source, "source", errors);
  const codexSessionId =
    typeof body.codex_session_id === "string"
      ? body.codex_session_id.trim()
      : null;
  const requestedStatus =
    typeof body.status === "string" ? body.status.trim() : "completed";

  if (!body.execution_report && !body.context_pack) {
    errors.push("execution_report or context_pack is required");
  }
  if (requestedStatus && !RUN_STATUSES.includes(requestedStatus)) {
    errors.push(`status must be one of: ${RUN_STATUSES.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      project_id: projectId,
      cycle_id: cycleId,
      source,
      status: requestedStatus || "completed",
      execution_report: body.execution_report ?? null,
      context_pack: body.context_pack ?? null,
      codex_session_id: codexSessionId,
    },
  };
}

export function assertValid(result) {
  if (!result.valid) {
    throw new HttpError(400, "Validation failed", result.errors);
  }
  return result.value;
}
