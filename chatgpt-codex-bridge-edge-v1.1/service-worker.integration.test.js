import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHubServer } from "../brain_hub/local_hub_v2/src/server.js";

function createChromeMock() {
  const runtimeMessageListeners = [];
  const runtimeInstalledListeners = [];
  const storageChangeListeners = [];
  const actionState = {
    badgeText: "",
    badgeColor: null,
    title: ""
  };
  let storage = {};

  return {
    api: {
      runtime: {
        onInstalled: {
          addListener(listener) {
            runtimeInstalledListeners.push(listener);
          }
        },
        onMessage: {
          addListener(listener) {
            runtimeMessageListeners.push(listener);
          }
        }
      },
      storage: {
        local: {
          async get(key) {
            if (!key) {
              return { ...storage };
            }

            if (typeof key === "string") {
              return { [key]: storage[key] };
            }

            const result = {};
            for (const entry of key) {
              result[entry] = storage[entry];
            }
            return result;
          },
          async set(next) {
            const previous = { ...storage };
            storage = { ...storage, ...next };
            const changes = {};

            for (const key of Object.keys(next)) {
              changes[key] = {
                oldValue: previous[key],
                newValue: storage[key]
              };
            }

            for (const listener of storageChangeListeners) {
              listener(changes, "local");
            }
          }
        },
        onChanged: {
          addListener(listener) {
            storageChangeListeners.push(listener);
          }
        }
      },
      action: {
        async setBadgeBackgroundColor({ color }) {
          actionState.badgeColor = color;
        },
        async setBadgeText({ text }) {
          actionState.badgeText = text;
        },
        async setTitle({ title }) {
          actionState.title = title;
        }
      }
    },
    runtimeMessageListeners,
    runtimeInstalledListeners,
    actionState,
    getStorage() {
      return structuredClone(storage);
    }
  };
}

async function invokeRuntimeMessage(listener, message, sender = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    try {
      const keepAlive = listener(message, sender, finish);
      if (keepAlive !== true) {
        finish(undefined);
      }
    } catch (error) {
      reject(error);
    }
  });
}

test("extension background sends packets to Local Hub and reads latest run state", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-extension-test-"));
  const testFilePath = fileURLToPath(import.meta.url);
  const extensionRoot = path.dirname(testFilePath);
  const projectRoot = path.resolve(extensionRoot, "..", "brain_hub", "local_hub_v2");
  const hub = await createHubServer({
    port: 8765,
    root_dir: "./workflow_bridge",
    rootDir: path.join(tempRoot, "workflow_bridge"),
    projectRoot,
    codex_adapter_cmd: "node ./adapters/mock-codex-adapter.js"
  });

  const previousChrome = globalThis.chrome;
  const chromeMock = createChromeMock();
  globalThis.chrome = chromeMock.api;

  try {
    await hub.start();

    const workerModuleUrl =
      `${pathToFileURL(path.join(extensionRoot, "service-worker.js")).href}?test=${Date.now()}`;
    await import(workerModuleUrl);

    assert.equal(chromeMock.runtimeMessageListeners.length > 0, true);
    assert.equal(chromeMock.runtimeInstalledListeners.length > 0, true);

    const messageListener = chromeMock.runtimeMessageListeners[0];
    const sender = {
      tab: {
        id: 7,
        url: "https://chatgpt.com/c/manual-test"
      }
    };

    const packetText = [
      "project_id: extension_bridge_demo",
      "cycle_id: 001",
      "stage: strategy",
      "goal: Verify browser extension to Local Hub integration",
      "constraints:",
      "  - Keep this as a test run",
      "next_action: codex_execute"
    ].join("\n");

    const packetResponse = await invokeRuntimeMessage(messageListener, {
      type: "WEB_CONTEXT_PACKET",
      payload: {
        packet: packetText,
        capturedAt: new Date().toISOString(),
        pageUrl: sender.tab.url,
        pageTitle: "Manual ChatGPT Test",
        userAgent: "UnitTestAgent/1.0"
      }
    }, sender);

    assert.equal(packetResponse.ok, true);
    assert.equal(packetResponse.status, 200);

    const initialState = await invokeRuntimeMessage(messageListener, {
      type: "GET_BRIDGE_STATE"
    });

    assert.equal(initialState.lastPacket.projectId, "extension_bridge_demo");
    assert.equal(initialState.projectSnapshot.state.current_status, "pending");

    const dispatchResponse = await invokeRuntimeMessage(messageListener, {
      type: "DISPATCH_RUN",
      projectId: "extension_bridge_demo",
      cycleId: "001"
    });

    assert.equal(dispatchResponse.ok, true);
    assert.equal(dispatchResponse.body.status, "completed");

    const finalState = await invokeRuntimeMessage(messageListener, {
      type: "GET_BRIDGE_STATE"
    });

    assert.equal(finalState.hub.ok, true);
    assert.equal(finalState.projectSnapshot.state.current_status, "completed");
    assert.equal(finalState.projectSnapshot.latestExecution !== null, true);
    assert.equal(finalState.projectSnapshot.latestContextPack !== null, true);
    assert.match(
      finalState.projectSnapshot.latestExecution.parsed.summary[0],
      /Mock adapter received strategy goal/
    );

    assert.equal(chromeMock.actionState.badgeText, "OK");
  } finally {
    await hub.stop();
    await fs.rm(tempRoot, { recursive: true, force: true });
    globalThis.chrome = previousChrome;
  }
});
