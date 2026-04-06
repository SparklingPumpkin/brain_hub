import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLoopbackPrompt,
  defaultBridgeState,
  normalizeState,
  parsePacketFields,
} from "./service-worker.js";

test("parsePacketFields extracts the expected strategy fields", () => {
  const packetFields = parsePacketFields([
    "project_id: personal_blog_smoke",
    "cycle_id: 002",
    "stage: strategy",
    "goal: Refine the blog layout",
    "next_action: codex_execute",
  ].join("\n"));

  assert.deepEqual(packetFields, {
    projectId: "personal_blog_smoke",
    cycleId: "002",
    stage: "strategy",
    goal: "Refine the blog layout",
    nextAction: "codex_execute",
  });
});

test("normalizeState preserves defaults while merging persisted values", () => {
  const state = normalizeState({
    settings: {
      autoDispatch: true,
    },
    lastPacket: {
      projectId: "demo",
      cycleId: "001",
    },
  });

  assert.equal(state.settings.autoDispatch, true);
  assert.equal(state.settings.returnResultsToChatGpt, true);
  assert.equal(state.loopback.status, "idle");
  assert.equal(state.lastPacket.projectId, "demo");
});

test("buildLoopbackPrompt formats execution context for ChatGPT", () => {
  const prompt = buildLoopbackPrompt({
    ...defaultBridgeState(),
    lastPacket: {
      projectId: "personal_blog_smoke",
      cycleId: "002",
    },
    projectSnapshot: {
      state: {
        project_id: "personal_blog_smoke",
        active_cycle_id: "002",
        current_status: "completed",
      },
      latestExecution: {
        parsed: {
          summary: ["Updated typography hierarchy."],
          verification: ["Reviewed generated HTML and CSS."],
          open_issues: [],
          risks: [],
        },
      },
      latestContextPack: {
        parsed: {
          completed: ["Applied a cleaner mobile layout."],
          key_files: ["index.html", "styles.css"],
          suggested_next_step: "Review the result in the browser.",
          web_recovery_prompt: "Continue refining the personal blog only if the user asks.",
        },
      },
    },
  });

  assert.match(prompt, /Local Hub completed a run for project personal_blog_smoke cycle 002/);
  assert.match(prompt, /```local-hub-context/);
  assert.match(prompt, /Updated typography hierarchy/);
  assert.match(prompt, /Review the result in the browser/);
  assert.match(prompt, /Do not emit a new context-packet unless the user explicitly asks for one/);
});
