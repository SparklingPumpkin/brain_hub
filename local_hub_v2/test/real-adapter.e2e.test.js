import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHubServer } from "../src/server.js";

const execFileAsync = promisify(execFile);

async function createWorkspace(tempRoot) {
  const workspace = path.join(tempRoot, "workspace");
  await fs.mkdir(path.join(workspace, "src"), { recursive: true });
  await fs.writeFile(
    path.join(workspace, "src", "sum.js"),
    "export function sum(a, b) {\n  return a + b;\n}\n",
    "utf8"
  );
  await execFileAsync("git", ["init"], { cwd: workspace });
  return workspace;
}

async function startHub({
  tempRoot,
  workspace,
  fakeMode,
  projectRoot,
}) {
  const adapterCommand = [
    "node ./adapters/real-codex-adapter.js",
    `--workspace "${workspace}"`,
    `--codex-cmd "node ./test/fixtures/fake-codex-cli.js --mode ${fakeMode}"`,
  ].join(" ");

  const hub = await createHubServer({
    port: 0,
    root_dir: "./workflow_bridge",
    rootDir: path.join(tempRoot, "workflow_bridge"),
    projectRoot,
    codex_adapter_cmd: adapterCommand,
  });
  await hub.start();
  return hub;
}

async function createStrategy(baseUrl, { projectId, cycleId, goal }) {
  const response = await fetch(`${baseUrl}/packets/web`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "edge-extension",
      packet: [
        `project_id: ${projectId}`,
        `cycle_id: ${cycleId}`,
        "stage: strategy",
        `goal: ${goal}`,
        "constraints:",
        "  - Keep API contract stable",
        "next_action: codex_execute",
      ].join("\n"),
      meta: {
        page_url: "https://chatgpt.com/example",
      },
    }),
  });
  assert.equal(response.status, 200);
}

test("real adapter success path posts completed codex packet", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-hub-v2-real-ok-"));
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workspace = await createWorkspace(tempRoot);
  const hub = await startHub({
    tempRoot,
    workspace,
    fakeMode: "success",
    projectRoot,
  });

  try {
    const baseUrl = `http://127.0.0.1:${hub.address().port}`;
    await createStrategy(baseUrl, {
      projectId: "demo_real_ok",
      cycleId: "001",
      goal: "Implement multiply in sum module",
    });

    const dispatchResponse = await fetch(
      `${baseUrl}/runs/demo_real_ok/001/dispatch`,
      { method: "POST" }
    );
    assert.equal(dispatchResponse.status, 200);
    const dispatchBody = await dispatchResponse.json();
    assert.equal(dispatchBody.status, "completed");

    const latestExecutionResponse = await fetch(
      `${baseUrl}/projects/demo_real_ok/latest-execution`
    );
    assert.equal(latestExecutionResponse.status, 200);
    const latestExecution = await latestExecutionResponse.json();
    assert.equal(latestExecution.packet.parsed.risks.length, 0);
    assert.equal(
      latestExecution.packet.parsed.changed_files.includes("src/sum.js"),
      true
    );
    assert.match(
      latestExecution.packet.parsed.summary.join("\n"),
      /Implemented multiply helper/
    );
  } finally {
    await hub.stop();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("real adapter failure path posts blocked codex packet", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-hub-v2-real-fail-"));
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workspace = await createWorkspace(tempRoot);
  const hub = await startHub({
    tempRoot,
    workspace,
    fakeMode: "fail",
    projectRoot,
  });

  try {
    const baseUrl = `http://127.0.0.1:${hub.address().port}`;
    await createStrategy(baseUrl, {
      projectId: "demo_real_fail",
      cycleId: "001",
      goal: "Implement multiply in sum module",
    });

    const dispatchResponse = await fetch(
      `${baseUrl}/runs/demo_real_fail/001/dispatch`,
      { method: "POST" }
    );
    assert.equal(dispatchResponse.status, 200);
    const dispatchBody = await dispatchResponse.json();
    assert.equal(dispatchBody.status, "blocked");

    const stateResponse = await fetch(`${baseUrl}/projects/demo_real_fail/state`);
    assert.equal(stateResponse.status, 200);
    const stateBody = await stateResponse.json();
    assert.equal(stateBody.state.current_status, "blocked");

    const latestExecutionResponse = await fetch(
      `${baseUrl}/projects/demo_real_fail/latest-execution`
    );
    assert.equal(latestExecutionResponse.status, 200);
    const latestExecution = await latestExecutionResponse.json();
    assert.match(
      latestExecution.packet.parsed.risks.join("\n"),
      /Intentional fake codex failure/
    );
  } finally {
    await hub.stop();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
