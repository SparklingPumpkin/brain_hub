const HUB_BASE_URL = 'http://127.0.0.1:8765';
const STORAGE_KEY = 'bridgeState';

function defaultBridgeState() {
  return {
    hub: {
      baseUrl: HUB_BASE_URL,
      ok: false,
      status: null,
      version: null,
      checkedAt: null,
      error: null
    },
    lastPacket: null,
    lastSubmission: null,
    projectSnapshot: null
  };
}

function parsePacketFields(packetText) {
  const text = String(packetText || '');
  const getField = (fieldName) => {
    const match = text.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  };

  return {
    projectId: getField('project_id'),
    cycleId: getField('cycle_id'),
    stage: getField('stage'),
    goal: getField('goal'),
    nextAction: getField('next_action')
  };
}

async function readBridgeState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return {
    ...defaultBridgeState(),
    ...(result[STORAGE_KEY] || {})
  };
}

async function writeBridgeState(nextState) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: nextState
  });
  await syncActionState(nextState);
  return nextState;
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchHub(path, options) {
  const response = await fetch(`${HUB_BASE_URL}${path}`, options);
  const text = await response.text();
  const json = parseJsonSafely(text);

  return {
    ok: response.ok,
    status: response.status,
    body: json ?? text
  };
}

async function fetchHubHealth() {
  try {
    const response = await fetchHub('/health');
    return {
      ok: response.ok,
      status: response.status,
      version: response.body && typeof response.body === 'object'
        ? response.body.version ?? null
        : null,
      checkedAt: new Date().toISOString(),
      error: response.ok ? null : JSON.stringify(response.body)
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      version: null,
      checkedAt: new Date().toISOString(),
      error: String(error)
    };
  }
}

async function fetchProjectSnapshot(projectId) {
  const encodedProjectId = encodeURIComponent(projectId);
  const stateResponse = await fetchHub(`/projects/${encodedProjectId}/state`);

  if (!stateResponse.ok || !stateResponse.body || typeof stateResponse.body !== 'object') {
    return {
      ok: false,
      error: stateResponse.body,
      state: null,
      latestExecution: null,
      latestContextPack: null,
      refreshedAt: new Date().toISOString()
    };
  }

  const snapshot = {
    ok: true,
    error: null,
    state: stateResponse.body.state ?? null,
    latestExecution: null,
    latestContextPack: null,
    refreshedAt: new Date().toISOString()
  };

  if (snapshot.state && snapshot.state.latest_execution_packet_id) {
    const executionResponse = await fetchHub(`/projects/${encodedProjectId}/latest-execution`);
    if (executionResponse.ok && executionResponse.body && typeof executionResponse.body === 'object') {
      snapshot.latestExecution = executionResponse.body.packet ?? null;
    }
  }

  if (snapshot.state && snapshot.state.latest_context_pack_id) {
    const contextResponse = await fetchHub(`/projects/${encodedProjectId}/latest-context-pack`);
    if (contextResponse.ok && contextResponse.body && typeof contextResponse.body === 'object') {
      snapshot.latestContextPack = contextResponse.body.packet ?? null;
    }
  }

  return snapshot;
}

async function refreshBridgeState(projectIdOverride = null) {
  const current = await readBridgeState();
  const projectId = projectIdOverride || current.lastPacket?.projectId || current.projectSnapshot?.state?.project_id || null;
  const hub = await fetchHubHealth();

  const nextState = {
    ...current,
    hub
  };

  if (projectId) {
    nextState.projectSnapshot = await fetchProjectSnapshot(projectId);
  }

  return writeBridgeState(nextState);
}

async function syncActionState(state) {
  const status = state.projectSnapshot?.state?.current_status || null;
  const hubOk = Boolean(state.hub?.ok);

  let badgeText = '';
  let badgeColor = '#6b7280';
  let title = 'ChatGPT Codex Bridge';

  if (!hubOk) {
    badgeText = 'OFF';
    badgeColor = '#b91c1c';
    title = 'Hub offline or unreachable';
  } else if (status === 'completed') {
    badgeText = 'OK';
    badgeColor = '#15803d';
    title = 'Latest run completed';
  } else if (status === 'running' || status === 'dispatched') {
    badgeText = 'RUN';
    badgeColor = '#1d4ed8';
    title = 'Latest run is in progress';
  } else if (status === 'pending') {
    badgeText = 'NEW';
    badgeColor = '#b45309';
    title = 'Latest packet received and waiting for dispatch';
  } else if (status === 'needs_review') {
    badgeText = 'REV';
    badgeColor = '#a16207';
    title = 'Latest run needs review';
  } else if (status === 'blocked') {
    badgeText = 'ERR';
    badgeColor = '#b91c1c';
    title = 'Latest run is blocked';
  } else if (hubOk) {
    badgeText = 'ON';
    badgeColor = '#0f766e';
    title = 'Hub connected';
  }

  await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  await chrome.action.setBadgeText({ text: badgeText });
  await chrome.action.setTitle({ title });
}

async function handleWebContextPacket(message, sender) {
  const payload = message.payload;
  const packetText =
    typeof payload === 'string'
      ? payload
      : (payload && typeof payload.packet === 'string' ? payload.packet : '');

  if (!packetText) {
    return {
      ok: false,
      error: 'Missing packet text in extension message'
    };
  }

  const packetFields = parsePacketFields(packetText);
  const current = await readBridgeState();
  const nextState = {
    ...current,
    lastPacket: {
      packetText,
      capturedAt:
        payload && typeof payload === 'object' ? payload.capturedAt ?? null : null,
      pageUrl:
        payload && typeof payload === 'object' ? payload.pageUrl ?? sender?.tab?.url ?? null : sender?.tab?.url ?? null,
      pageTitle:
        payload && typeof payload === 'object' ? payload.pageTitle ?? null : null,
      userAgent:
        payload && typeof payload === 'object' ? payload.userAgent ?? null : null,
      tabId: sender?.tab?.id ?? null,
      ...packetFields
    }
  };

  await writeBridgeState(nextState);
  console.log('[bridge sw] received packet from content script');

  try {
    const response = await fetchHub('/packets/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'web',
        packet: packetText,
        meta: {
          capturedAt:
            payload && typeof payload === 'object' ? payload.capturedAt ?? null : null,
          pageUrl:
            payload && typeof payload === 'object' ? payload.pageUrl ?? sender?.tab?.url ?? null : sender?.tab?.url ?? null,
          pageTitle:
            payload && typeof payload === 'object' ? payload.pageTitle ?? null : null,
          userAgent:
            payload && typeof payload === 'object' ? payload.userAgent ?? null : null,
          tabId: sender?.tab?.id ?? null
        }
      })
    });

    console.log('[bridge sw] localhost response status =', response.status);
    console.log('[bridge sw] localhost response body =', response.body);

    const refreshed = await refreshBridgeState(packetFields.projectId);
    const finalState = {
      ...refreshed,
      lastSubmission: {
        ok: response.ok,
        status: response.status,
        body: response.body,
        submittedAt: new Date().toISOString()
      }
    };
    await writeBridgeState(finalState);

    return {
      ok: response.ok,
      status: response.status,
      body: response.body
    };
  } catch (error) {
    const failed = {
      ...(await refreshBridgeState(packetFields.projectId)),
      lastSubmission: {
        ok: false,
        status: null,
        body: null,
        submittedAt: new Date().toISOString(),
        error: String(error)
      }
    };
    await writeBridgeState(failed);
    console.error('[bridge sw] fetch to localhost failed:', error);
    return {
      ok: false,
      error: String(error)
    };
  }
}

async function handleGetBridgeState() {
  return refreshBridgeState();
}

async function handleRefreshBridgeState(message) {
  return refreshBridgeState(message.projectId ?? null);
}

async function handleDispatchRun(message) {
  const current = await readBridgeState();
  const projectId = message.projectId ?? current.lastPacket?.projectId ?? current.projectSnapshot?.state?.project_id;
  const cycleId = message.cycleId ?? current.lastPacket?.cycleId ?? current.projectSnapshot?.state?.active_cycle_id;

  if (!projectId || !cycleId) {
    return {
      ok: false,
      error: 'No project_id/cycle_id available for dispatch'
    };
  }

  const response = await fetchHub(`/runs/${encodeURIComponent(projectId)}/${encodeURIComponent(cycleId)}/dispatch`, {
    method: 'POST'
  });

  const refreshed = await refreshBridgeState(projectId);
  const nextState = {
    ...refreshed,
    lastSubmission: {
      ...(refreshed.lastSubmission || {}),
      lastDispatchAt: new Date().toISOString(),
      lastDispatchResponse: response
    }
  };
  await writeBridgeState(nextState);

  return response;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('ChatGPT Codex Bridge for Edge installed.');
  refreshBridgeState().catch((error) => {
    console.error('[bridge sw] failed to initialize bridge state:', error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  (async () => {
    try {
      if (message.type === 'WEB_CONTEXT_PACKET') {
        sendResponse(await handleWebContextPacket(message, sender));
        return;
      }

      if (message.type === 'GET_BRIDGE_STATE') {
        sendResponse(await handleGetBridgeState());
        return;
      }

      if (message.type === 'REFRESH_BRIDGE_STATE') {
        sendResponse(await handleRefreshBridgeState(message));
        return;
      }

      if (message.type === 'DISPATCH_RUN') {
        sendResponse(await handleDispatchRun(message));
        return;
      }

      sendResponse({
        ok: false,
        error: `Unsupported message type: ${message.type}`
      });
    } catch (error) {
      console.error('[bridge sw] message handler failed:', error);
      sendResponse({
        ok: false,
        error: String(error)
      });
    }
  })();

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY]) {
    return;
  }
  syncActionState(changes[STORAGE_KEY].newValue || defaultBridgeState()).catch((error) => {
    console.error('[bridge sw] failed to sync badge state:', error);
  });
});
