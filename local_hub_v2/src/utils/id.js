import crypto from "node:crypto";

function compactDate(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function nowIso() {
  return new Date().toISOString();
}

export function createPacketId(prefix = "pkt") {
  return `${prefix}_${compactDate()}_${crypto.randomUUID().slice(0, 8)}`;
}

export function createRunId(projectId, cycleId) {
  return `run_${projectId}_${cycleId}`;
}
