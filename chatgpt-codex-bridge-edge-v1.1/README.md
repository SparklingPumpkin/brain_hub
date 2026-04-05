# ChatGPT Codex Bridge for Edge v0.2.0

This package contains:
- A Manifest V3 extension compatible with Microsoft Edge
- Browser-to-localhost packet delivery
- A popup that reads Local Hub status and latest results

## Expected packet format on ChatGPT

Ask ChatGPT to emit exactly one fenced block like this:

```context-packet
project_id: demo
cycle_id: 001
stage: strategy
goal: Add idempotency handling to payment creation
constraints:
  - Do not change the API response shape
next_action: codex_execute
```

## Run the Local Hub

Use the newer Hub in `brain_hub/local_hub_v2` rather than the legacy mini server in this extension folder.

1. Open a terminal in `brain_hub/local_hub_v2`.
2. Start the Hub:
   `npm start`
3. Verify:
   `http://127.0.0.1:8765/health`

## Load in Microsoft Edge

1. Open Edge and visit: edge://extensions
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder.
5. Open ChatGPT in Edge.
6. Let ChatGPT output a `context-packet` block.

## Result

When the extension captures a new packet, it POSTs the packet to the Local Hub.

The extension popup now lets you:

- Check whether the Hub is online
- See the latest captured packet metadata
- Refresh the latest project state from the Hub
- Trigger `POST /runs/:projectId/:cycleId/dispatch` for the latest run
- Read the latest execution summary and suggested next step

## Notes

- This extension matches both `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- The same MV3 structure also works in Chromium-based browsers.
- The popup depends on the Local Hub read-model endpoints:
  - `GET /projects/:projectId/state`
  - `GET /projects/:projectId/latest-execution`
  - `GET /projects/:projectId/latest-context-pack`
