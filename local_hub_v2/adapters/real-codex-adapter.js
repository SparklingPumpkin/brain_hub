import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const parsed = {};

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key.slice(2)] = true;
      continue;
    }

    parsed[key.slice(2)] = next;
    index += 1;
  }

  return parsed;
}

export function splitCommandLine(commandLine) {
  const matches =
    String(commandLine ?? "")
      .match(/(?:[^\s"]+|"[^"]*")+/g)
      ?.map((token) => token.replace(/^"(.*)"$/, "$1")) ?? [];

  if (matches.length === 0) {
    throw new Error("Command line is empty");
  }

  return matches;
}

function normalizeStringArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
}

function normalizeExecutionReport(report) {
  if (!report || typeof report !== "object") {
    throw new Error("execution_report is required");
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
  if (!contextPack || typeof contextPack !== "object") {
    throw new Error("context_pack is required");
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

function normalizeFinalStatus(status, executionReport, contextPack) {
  const normalizedStatus =
    typeof status === "string" ? status.trim() : "completed";

  if (normalizedStatus === "blocked") {
    return "blocked";
  }

  if (
    normalizedStatus === "needs_review" ||
    executionReport.risks.length > 0 ||
    contextPack.risks.length > 0
  ) {
    return "needs_review";
  }

  return "completed";
}

export function normalizeModelResponse(response) {
  if (!response || typeof response !== "object") {
    throw new Error("Model response must be a JSON object");
  }

  const executionReport = normalizeExecutionReport(response.execution_report);
  const contextPack = normalizeContextPack(response.context_pack);
  const status = normalizeFinalStatus(
    response.status,
    executionReport,
    contextPack
  );

  return {
    execution_report: executionReport,
    context_pack: contextPack,
    status,
  };
}

function extractBalancedJson(text) {
  const startIndex = text.indexOf("{");
  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

export function parseJsonResponse(rawText) {
  const text = String(rawText ?? "").trim();

  if (!text) {
    throw new Error("Codex response was empty");
  }

  try {
    return JSON.parse(text);
  } catch {
    // Fall through to fenced / embedded JSON extraction.
  }

  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return JSON.parse(fencedMatch[1].trim());
  }

  const embedded = extractBalancedJson(text);
  if (embedded) {
    return JSON.parse(embedded);
  }

  throw new Error("Could not parse JSON from Codex response");
}

export function buildOutputSchema() {
  const stringArraySchema = {
    type: "array",
    items: {
      type: "string",
    },
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["execution_report", "context_pack", "status"],
    properties: {
      execution_report: {
        type: "object",
        additionalProperties: false,
        required: [
          "changed_files",
          "summary",
          "verification",
          "open_issues",
          "risks",
          "next_step",
        ],
        properties: {
          changed_files: stringArraySchema,
          summary: stringArraySchema,
          verification: stringArraySchema,
          open_issues: stringArraySchema,
          risks: stringArraySchema,
          next_step: {
            type: "string",
          },
        },
      },
      context_pack: {
        type: "object",
        additionalProperties: false,
        required: [
          "current_goal",
          "completed",
          "key_files",
          "latest_verification",
          "open_questions",
          "risks",
          "suggested_next_step",
          "web_recovery_prompt",
        ],
        properties: {
          current_goal: {
            type: "string",
          },
          completed: stringArraySchema,
          key_files: stringArraySchema,
          latest_verification: stringArraySchema,
          open_questions: stringArraySchema,
          risks: stringArraySchema,
          suggested_next_step: {
            type: "string",
          },
          web_recovery_prompt: {
            type: "string",
          },
        },
      },
      status: {
        type: "string",
        enum: ["completed", "needs_review", "blocked"],
      },
    },
  };
}

export function buildCodexPrompt(packet, { projectId, cycleId, workdir }) {
  const constraints =
    packet?.parsed?.constraints?.length > 0
      ? packet.parsed.constraints.map((item) => `- ${item}`).join("\n")
      : "- No explicit constraints were provided.";

  return [
    "You are the real Local Hub V2 Codex adapter.",
    `Project ID: ${projectId}`,
    `Cycle ID: ${cycleId}`,
    `Working directory: ${workdir}`,
    "",
    "Execute the strategy packet in the current working directory.",
    "Follow the goal and constraints carefully.",
    "If the task is ambiguous, risky, or cannot be safely completed, prefer conservative behavior and set status to needs_review or blocked.",
    "Return only the final JSON object that matches the provided schema.",
    "Use relative paths in changed_files and key_files.",
    "",
    "Strategy packet:",
    JSON.stringify(packet, null, 2),
    "",
    "Goal:",
    String(packet?.parsed?.goal ?? "No goal provided"),
    "",
    "Constraints:",
    constraints,
    "",
    "Remember:",
    "- summary should describe what was actually done",
    "- verification should list commands or checks you ran",
    "- open_issues should list unresolved issues",
    "- risks should be empty when safe, otherwise explain concrete risks",
    "- web_recovery_prompt should help the browser-side assistant continue the next turn",
  ].join("\n");
}

function buildCodexExecInvocation(options) {
  const baseCommand = splitCommandLine(options.codexExecCommand ?? "codex exec");
  const [command, ...baseArgs] = baseCommand;
  const args = [...baseArgs];

  args.push("--output-schema", options.schemaPath);
  args.push("-o", options.outputPath);
  args.push("--cd", options.workdir);
  args.push("--color", "never");
  args.push("--ephemeral");

  if (options.skipGitRepoCheck) {
    args.push("--skip-git-repo-check");
  }

  if (options.sandbox) {
    args.push("--sandbox", options.sandbox);
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.profile) {
    args.push("--profile", options.profile);
  }

  args.push("-");

  return {
    command,
    args,
  };
}

export async function runCodexExec({
  codexExecCommand,
  workdir,
  schemaPath,
  outputPath,
  prompt,
  sandbox,
  model,
  profile,
  skipGitRepoCheck,
}) {
  const invocation = buildCodexExecInvocation({
      codexExecCommand,
      workdir,
      schemaPath,
      outputPath,
      sandbox,
      model,
      profile,
      skipGitRepoCheck,
  });

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: workdir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", reject);
    child.stdin.end(prompt);

    child.once("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
        return;
      }

      const error = new Error(
        `Codex exec exited with code ${code}: ${stderr || stdout}`.trim()
      );
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function postCodexResult(hubUrl, payload) {
  const response = await fetch(`${hubUrl}/packets/codex`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Hub callback failed with status ${response.status}: ${responseText}`.trim()
    );
  }
}

export async function executeRealCodexAdapter(args) {
  if (!args.input || !args.hub || !args.project || !args.cycle) {
    throw new Error("Missing required adapter arguments");
  }

  const packet = JSON.parse(await fs.readFile(args.input, "utf8"));
  const workdir = path.resolve(args.workdir ?? process.cwd());
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "local-hub-real-adapter-"));
  const schemaPath = path.join(tempDir, "codex-output-schema.json");
  const outputPath = path.join(tempDir, "codex-last-message.json");

  try {
    await fs.writeFile(
      schemaPath,
      `${JSON.stringify(buildOutputSchema(), null, 2)}\n`,
      "utf8"
    );

    const prompt = buildCodexPrompt(packet, {
      projectId: args.project,
      cycleId: args.cycle,
      workdir,
    });

    const execution = await runCodexExec({
      codexExecCommand: args["codex-exec-cmd"] ?? "codex exec",
      workdir,
      schemaPath,
      outputPath,
      prompt,
      sandbox: args.sandbox ?? "workspace-write",
      model: args.model,
      profile: args.profile,
      skipGitRepoCheck: Boolean(args["skip-git-repo-check"]),
    });

    const rawResponse = await fs.readFile(outputPath, "utf8").catch(() => "");
    const parsedResponse = normalizeModelResponse(
      parseJsonResponse(rawResponse || execution.stdout || execution.stderr)
    );

    await postCodexResult(args.hub, {
      project_id: args.project,
      cycle_id: args.cycle,
      source: "codex-real-adapter",
      execution_report: parsedResponse.execution_report,
      context_pack: parsedResponse.context_pack,
      status: parsedResponse.status,
    });

    return parsedResponse;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

const isEntrypoint =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isEntrypoint) {
  executeRealCodexAdapter(parseArgs(process.argv)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
