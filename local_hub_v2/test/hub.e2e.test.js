import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHubServer } from "../src/server.js";

test("hub stores strategy packet, dispatches mock adapter, and exposes latest state", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-hub-v2-"));
  const testFilePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(testFilePath), "..");
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
    const baseUrl = `http://127.0.0.1:${port}`;

    const packetResponse = await fetch(`${baseUrl}/packets/web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "edge-extension",
        packet: [
          "project_id: demo",
          "cycle_id: 001",
          "stage: strategy",
          "goal: Build the local hub",
          "constraints:",
          "  - Keep the first version file-based",
          "next_action: codex_execute",
        ].join("\n"),
        meta: {
          page_url: "https://chatgpt.com/example",
        },
      }),
    });
    assert.equal(packetResponse.status, 200);
    const packetBody = await packetResponse.json();
    assert.equal(packetBody.ok, true);
    assert.equal(packetBody.status, "pending");

    const dispatchResponse = await fetch(`${baseUrl}/runs/demo/001/dispatch`, {
      method: "POST",
    });
    assert.equal(dispatchResponse.status, 200);
    const dispatchBody = await dispatchResponse.json();
    assert.equal(dispatchBody.ok, true);
    assert.equal(dispatchBody.status, "completed");

    const stateResponse = await fetch(`${baseUrl}/projects/demo/state`);
    assert.equal(stateResponse.status, 200);
    const stateBody = await stateResponse.json();
    assert.equal(stateBody.state.current_status, "completed");
    assert.equal(stateBody.state.latest_execution_packet_id !== null, true);
    assert.equal(stateBody.state.latest_context_pack_id !== null, true);

    const latestExecutionResponse = await fetch(
      `${baseUrl}/projects/demo/latest-execution`
    );
    assert.equal(latestExecutionResponse.status, 200);
    const latestExecutionBody = await latestExecutionResponse.json();
    assert.match(
      latestExecutionBody.packet.parsed.summary[0],
      /Mock adapter received strategy goal/
    );

    const runFile = path.join(
      tempRoot,
      "workflow_bridge",
      "projects",
      "demo",
      "runs",
      "001",
      "run.json"
    );
    const runRecord = JSON.parse(await fs.readFile(runFile, "utf8"));
    assert.equal(runRecord.status, "completed");
  } finally {
    await hub.stop();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
