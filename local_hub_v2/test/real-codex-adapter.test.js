import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildCodexPrompt,
  executeRealCodexAdapter,
  normalizeModelResponse,
  parseJsonResponse,
} from "../adapters/real-codex-adapter.js";
import { createHubServer } from "../src/server.js";

test("parseJsonResponse accepts direct JSON, fenced JSON, and embedded JSON", () => {
  assert.deepEqual(parseJsonResponse('{"ok":true}'), { ok: true });
  assert.deepEqual(parseJsonResponse("```json\n{\"ok\":true}\n```"), {
    ok: true,
  });
  assert.deepEqual(parseJsonResponse("result:\n{\"ok\":true}\nthanks"), {
    ok: true,
  });
});

test("normalizeModelResponse coerces arrays and risk-driven status", () => {
  const normalized = normalizeModelResponse({
    execution_report: {
      changed_files: "src/demo.js",
      summary: ["implemented adapter"],
      verification: "npm test",
      open_issues: [],
      risks: ["needs manual review"],
      next_step: "review",
    },
    context_pack: {
      current_goal: "wire adapter",
      completed: "added files",
      key_files: ["src/demo.js"],
      latest_verification: ["npm test"],
      open_questions: [],
      risks: [],
      suggested_next_step: "review output",
      web_recovery_prompt: "continue",
    },
    status: "completed",
  });

  assert.equal(normalized.status, "needs_review");
  assert.deepEqual(normalized.execution_report.changed_files, ["src/demo.js"]);
  assert.deepEqual(normalized.context_pack.completed, ["added files"]);
});

test("buildCodexPrompt includes strategy goal and constraints", () => {
  const prompt = buildCodexPrompt(
    {
      parsed: {
        goal: "Implement adapter",
        constraints: ["Do not delete files", "Keep JSON output strict"],
      },
    },
    {
      projectId: "demo",
      cycleId: "007",
      workdir: "E:/demo",
    }
  );

  assert.match(prompt, /Project ID: demo/);
  assert.match(prompt, /Cycle ID: 007/);
  assert.match(prompt, /Implement adapter/);
  assert.match(prompt, /Do not delete files/);
});

test("executeRealCodexAdapter runs configured codex command and posts normalized payload", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-hub-real-adapter-"));
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  const fakeCodexPath = path.join(tempRoot, "fake-codex.js");
  const workdir = path.join(tempRoot, "workspace");
  await fs.mkdir(workdir, { recursive: true });
  await fs.writeFile(path.join(workdir, "README.md"), "# Demo\n", "utf8");

  await fs.writeFile(
    fakeCodexPath,
    [
      "import fs from \"node:fs/promises\";",
      "const args = process.argv.slice(2);",
      "let outputFile = null;",
      "for (let index = 0; index < args.length; index += 1) {",
      "  if (args[index] === '-o') {",
      "    outputFile = args[index + 1];",
      "  }",
      "}",
      "const prompt = await new Promise((resolve) => {",
      "  let data = '';",
      "  process.stdin.on('data', (chunk) => { data += chunk.toString(); });",
      "  process.stdin.on('end', () => resolve(data));",
      "});",
      "const response = {",
      "  execution_report: {",
      "    changed_files: [],",
      "    summary: [prompt.includes('Inspect repository state') ? 'Inspected repository state.' : 'Prompt received.'],",
      "    verification: ['Fake codex runner executed'],",
      "    open_issues: [],",
      "    risks: [],",
      "    next_step: 'ready_for_review'",
      "  },",
      "  context_pack: {",
      "    current_goal: 'Inspect repository state',",
      "    completed: ['Collected repository summary'],",
      "    key_files: ['README.md'],",
      "    latest_verification: ['Fake codex runner executed'],",
      "    open_questions: [],",
      "    risks: [],",
      "    suggested_next_step: 'Swap the fake runner for codex exec.',",
      "    web_recovery_prompt: 'Continue from the fake runner test.'",
      "  },",
      "  status: 'completed'",
      "};",
      "await fs.writeFile(outputFile, JSON.stringify(response, null, 2));",
    ].join("\n"),
    "utf8"
  );

  const hub = await createHubServer({
    port: 0,
    root_dir: "./workflow_bridge",
    rootDir: path.join(tempRoot, "workflow_bridge"),
    projectRoot,
    codex_adapter_cmd: "node ./adapters/mock-codex-adapter.js",
  });

  try {
    await hub.start();
    const port = hub.address().port;
    const hubUrl = `http://127.0.0.1:${port}`;

    const packetResponse = await fetch(`${hubUrl}/packets/web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "edge-extension",
        packet: [
          "project_id: demo_real",
          "cycle_id: 001",
          "stage: strategy",
          "goal: Inspect repository state",
          "constraints:",
          "  - Do not modify files",
          "next_action: codex_execute",
        ].join("\n"),
      }),
    });
    assert.equal(packetResponse.status, 200);

    await executeRealCodexAdapter({
      input: path.join(
        tempRoot,
        "workflow_bridge",
        "projects",
        "demo_real",
        "runs",
        "001",
        "strategy.packet.json"
      ),
      hub: hubUrl,
      project: "demo_real",
      cycle: "001",
      workdir,
      "codex-exec-cmd": `node "${fakeCodexPath}"`,
      sandbox: "read-only",
      approval: "never",
      "skip-git-repo-check": true,
    });

    const stateResponse = await fetch(`${hubUrl}/projects/demo_real/state`);
    assert.equal(stateResponse.status, 200);
    const stateBody = await stateResponse.json();
    assert.equal(stateBody.state.current_status, "completed");

    const latestExecutionResponse = await fetch(
      `${hubUrl}/projects/demo_real/latest-execution`
    );
    const latestExecutionBody = await latestExecutionResponse.json();
    assert.equal(
      latestExecutionBody.packet.parsed.summary[0],
      "Inspected repository state."
    );
  } finally {
    await hub.stop();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
