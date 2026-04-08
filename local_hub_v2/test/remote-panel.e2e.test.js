import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHubServer } from "../src/server.js";

test("remote panel and remote api require token and can submit tasks", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "local-hub-v2-remote-panel-")
  );
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workspace = path.join(tempRoot, "workspace");
  await fs.mkdir(workspace, { recursive: true });
  await fs.writeFile(path.join(workspace, "README.md"), "# demo\n", "utf8");

  const hub = await createHubServer({
    port: 0,
    root_dir: "./workflow_bridge",
    rootDir: path.join(tempRoot, "workflow_bridge"),
    projectRoot,
    remote_control_enabled: true,
    remote_control_token: "test-token",
    codex_adapter_cmd:
      `node ./adapters/real-codex-adapter.js --workdir "${workspace}" --codex-cmd "node ./test/fixtures/fake-codex-cli.js --mode success"`,
  });

  try {
    await hub.start();
    const baseUrl = `http://127.0.0.1:${hub.address().port}`;

    const panelResponse = await fetch(`${baseUrl}/remote`);
    assert.equal(panelResponse.status, 200);
    const panelHtml = await panelResponse.text();
    assert.match(panelHtml, /Local Hub Remote/);

    const unauthorizedResponse = await fetch(`${baseUrl}/remote-api/overview`);
    assert.equal(unauthorizedResponse.status, 401);

    const taskResponse = await fetch(`${baseUrl}/remote-api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        project_id: "remote_demo",
        cycle_id: "001",
        goal: "Inspect the workspace",
        constraints: ["Do not modify files"],
        session_mode: "project",
        auto_dispatch: false,
      }),
    });
    assert.equal(taskResponse.status, 200);
    const taskBody = await taskResponse.json();
    assert.equal(taskBody.project_id, "remote_demo");
    assert.equal(taskBody.status, "pending");

    const overviewResponse = await fetch(`${baseUrl}/remote-api/overview`, {
      headers: {
        Authorization: "Bearer test-token",
      },
    });
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json();
    assert.equal(overview.projects[0].project_id, "remote_demo");
  } finally {
    await hub.stop();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
